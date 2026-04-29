import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role for backend scripts
const discogsToken = process.env.DISCOGS_TOKEN;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function updatePrices() {
  console.log("🚀 Starting price update...");

  // 1. Get all records from Supabase
  const { data: records, error: fetchError } = await supabase
    .from("records")
    .select("discogs_release_id");

  if (fetchError) {
    console.error("❌ Error fetching records:", fetchError);
    return;
  }

  console.log(`📦 Found ${records.length} records to update.`);

  for (const record of records) {
    const releaseId = record.discogs_release_id;
    console.log(`🔍 Fetching Discogs data for release ${releaseId}...`);

    try {
      // 2. Fetch marketplace stats from Discogs
      const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
        headers: {
          "Authorization": `Discogs token=${discogsToken}`,
          "User-Agent": "VinylIntelligence/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const releaseData = await response.json();
      const stats = releaseData.marketplace_stats;

      if (!stats) {
        console.warn(`⚠️ No marketplace stats for ID ${releaseId}`);
        continue;
      }

      // 3. Insert new price snapshot
      const { error: insertError } = await supabase
        .from("market_prices")
        .insert({
          release_id: releaseId.toString(),
          lowest_price: stats.lowest_price?.value || 0,
          median_price: stats.median_price?.value || 0,
          num_for_sale: stats.num_for_sale || 0,
          currency: stats.lowest_price?.currency || "EUR"
        });

      if (insertError) {
        console.error(`❌ Error inserting price for ${releaseId}:`, insertError);
      } else {
        console.log(`✅ Updated ID ${releaseId}: ${stats.median_price?.value || 0} EUR`);
      }

      // 4. Rate limiting (Discogs allows 60 requests/min with token)
      await new Promise(resolve => setTimeout(resolve, 1500)); 

    } catch (err) {
      console.error(`❌ Failed update for ${releaseId}:`, err);
    }
  }

  // 5. Update global collection snapshot
  console.log("📊 Creating global collection snapshot...");
  await createCollectionSnapshot();
  
  console.log("🏁 Update finished.");
}

async function createCollectionSnapshot() {
  // Logic to calculate total value and insert into collection_snapshots table
  // This is used for the trend chart
  const { data: latestPrices } = await supabase.rpc('get_latest_prices'); // Assuming a stored procedure or manual calc
  // For simplicity, manual calculation:
  const { data: prices } = await supabase.from("market_prices").select("*").order("created_at", { ascending: false });
  
  const uniquePrices = new Map();
  prices?.forEach(p => { if(!uniquePrices.has(p.release_id)) uniquePrices.set(p.release_id, p.median_price || p.lowest_price); });
  
  const totalValue = Array.from(uniquePrices.values()).reduce((a, b) => a + b, 0);

  await supabase.from("collection_snapshots").insert({ total_value: totalValue });
}

updatePrices();
