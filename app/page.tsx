import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";

export const revalidate = 3600;

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch data in parallel for maximum speed
  const [recordsResponse, pricesResponse, snapshotsResponse] = await Promise.all([
    supabase.from("records").select("*"),
    supabase.from("market_prices").select("*").order("created_at", { ascending: false }),
    supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true })
  ]);

  const allRecords = recordsResponse.data || [];
  const allPrices = pricesResponse.data || [];
  const snapshots = snapshotsResponse.data || [];

  // Deduplicate prices server-side to get the latest price per release
  const latestPricesMap = new Map();
  allPrices.forEach((p) => {
    if (!latestPricesMap.has(p.release_id)) {
      latestPricesMap.set(p.release_id, p);
    }
  });
  const latestPrices = Array.from(latestPricesMap.values());

  return (
    <ClientDashboard
      latestPrices={latestPrices}
      historicalPrices={allPrices}
      records={allRecords}
      snapshots={snapshots}
    />
  );
}