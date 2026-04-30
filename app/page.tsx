import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";

export const revalidate = 0;

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch all records overcoming the 1000 limit
  let allRecords: any[] = [];
  let fetched = 1000;
  let offset = 0;
  while(fetched === 1000) {
    const { data } = await supabase.from("records").select("*").range(offset, offset + 999);
    if(data && data.length > 0) {
      allRecords = allRecords.concat(data);
      fetched = data.length;
      offset += 1000;
    } else {
      fetched = 0;
    }
  }

  // Fetch all prices (ordering by created_at DESC to get latest)
  let allPrices: any[] = [];
  let fetchedPrices = 1000;
  let offsetPrices = 0;
  while(fetchedPrices === 1000) {
    const { data } = await supabase.from("market_prices").select("*").order("created_at", { ascending: false }).range(offsetPrices, offsetPrices + 999);
    if(data && data.length > 0) {
      allPrices = allPrices.concat(data);
      fetchedPrices = data.length;
      offsetPrices += 1000;
    } else {
      fetchedPrices = 0;
    }
  }

  // Deduplicate prices server-side to get the latest price per release
  const latestPricesMap = new Map();
  allPrices?.forEach((p) => {
    if (!latestPricesMap.has(p.release_id)) {
      latestPricesMap.set(p.release_id, p);
    }
  });
  const latestPrices = Array.from(latestPricesMap.values());

  // Fetch snapshots for investment chart
  const { data: snapshots } = await supabase
    .from("collection_snapshots")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <ClientDashboard
      latestPrices={latestPrices}
      historicalPrices={allPrices || []}
      records={allRecords || []}
      snapshots={snapshots || []}
    />
  );
}