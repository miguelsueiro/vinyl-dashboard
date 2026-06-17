import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";



export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch ALL data using pagination loops to overcome the 1000 row limit
  const fetchAll = async (table: string, orderCol?: string) => {
    let all: any[] = [];
    let fetched = 1000;
    let offset = 0;
    while (fetched === 1000) {
      let query = supabase.from(table).select("*").range(offset, offset + 999);
      if (orderCol) query = query.order(orderCol, { ascending: false });
      const { data } = await query;
      if (data && data.length > 0) {
        all = all.concat(data);
        fetched = data.length;
        offset += 1000;
      } else {
        fetched = 0;
      }
    }
    return all;
  };

  const [allRecords, allPrices, snapshotsRes] = await Promise.all([
    fetchAll("records"),
    fetchAll("market_prices", "created_at"),
    supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true })
  ]);

  const snapshots = snapshotsRes.data || [];

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