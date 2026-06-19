import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Helper to fetch all rows with pagination (max 1000 per request)
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

  // Helper to fetch recent 3000 market prices in parallel to compute trends
  const fetchRecentMarketPrices = async () => {
    const [page1, page2, page3] = await Promise.all([
      supabase.from("market_prices").select("release_id, median_price, lowest_price, created_at").order("created_at", { ascending: false }).range(0, 999),
      supabase.from("market_prices").select("release_id, median_price, lowest_price, created_at").order("created_at", { ascending: false }).range(1000, 1999),
      supabase.from("market_prices").select("release_id, median_price, lowest_price, created_at").order("created_at", { ascending: false }).range(2000, 2999)
    ]);
    return [
      ...(page1.data || []),
      ...(page2.data || []),
      ...(page3.data || [])
    ];
  };

  const [allRecords, latestPrices, snapshotsRes, recentMarketPrices] = await Promise.all([
    fetchAll("records"),
    fetchAll("latest_prices"),
    supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true }),
    fetchRecentMarketPrices()
  ]);

  const snapshots = snapshotsRes.data || [];

  console.log(`📊 DB Counts - Records: ${allRecords.length}, Latest Prices: ${latestPrices.length}, Snapshots: ${snapshots.length}, Hist Prices: ${recentMarketPrices.length}`);

  return (
    <ClientDashboard
      latestPrices={latestPrices}
      historicalPrices={recentMarketPrices}
      records={allRecords}
      snapshots={snapshots}
    />
  );
}
