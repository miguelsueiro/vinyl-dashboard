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

  const [allRecords, latestPricesRes, snapshotsRes] = await Promise.all([
    fetchAll("records"),
    supabase.from("latest_prices").select("*"),
    supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true })
  ]);

  const latestPrices = latestPricesRes.data || [];
  const snapshots = snapshotsRes.data || [];

  return (
    <ClientDashboard
      latestPrices={latestPrices}
      historicalPrices={[]}
      records={allRecords}
      snapshots={snapshots}
    />
  );
}
