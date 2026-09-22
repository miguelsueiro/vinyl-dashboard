import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";

export const dynamic = "force-dynamic";

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

  // Las flechas de tendencia salen de latest_prices.previous_price, que mantiene
  // la sincronización nocturna. Antes se cargaban las 3.000 filas más recientes
  // de market_prices en cada visita: ~2,2 días de historia con 1.330 discos, y
  // pasando de ~1.500 dejaba de haber dos lecturas por disco, así que los que
  // caían fuera del corte marcaban "estable" sin haberlo estado.
  const [allRecords, latestPrices, snapshotsRes, smartFoldersRes] = await Promise.all([
    fetchAll("records"),
    fetchAll("latest_prices"),
    supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true }),
    supabase.from("smart_folders").select("*").order("created_at", { ascending: true })
  ]);

  const snapshots = snapshotsRes.data || [];
  const smartFolders = smartFoldersRes.data || [];

  console.log(`📊 DB Counts - Records: ${allRecords.length}, Latest Prices: ${latestPrices.length}, Snapshots: ${snapshots.length}, Smart Folders: ${smartFolders.length}`);

  return (
    <ClientDashboard
      latestPrices={latestPrices}
      records={allRecords}
      snapshots={snapshots}
      initialSmartFolders={smartFolders}
    />
  );
}
