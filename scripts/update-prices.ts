import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const discogsToken = process.env.DISCOGS_TOKEN;

if (!supabaseUrl || !supabaseKey || !discogsToken) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runUpdate() {
  console.log("🚀 Starting industrial price update via GitHub Actions...");

  // 1. Get ALL records using pagination
  let allRecords: any[] = [];
  let fetchedCount = 1000;
  let offset = 0;
  
  while (fetchedCount === 1000) {
    const { data, error } = await supabase
      .from("records")
      .select("discogs_release_id")
      .range(offset, offset + 999);
    
    if (error) {
      console.error("Error fetching records:", error);
      process.exit(1);
    }
    if (data) {
      allRecords = allRecords.concat(data);
      fetchedCount = data.length;
      offset += 1000;
    } else {
      fetchedCount = 0;
    }
  }

  console.log(`📦 Found ${allRecords.length} records. Processing...`);

  // 2. Update each record with Discogs rate limiting (60req/min -> ~1s per request)
  for (let i = 0; i < allRecords.length; i++) {
    const releaseId = allRecords[i].discogs_release_id;
    console.log(`[${i+1}/${allRecords.length}] Updating ID ${releaseId}...`);

    try {
      const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
        headers: {
          "Authorization": `Discogs token=${discogsToken}`,
          "User-Agent": "VinylIntelligence/1.0"
        }
      });

      if (!response.ok) {
        console.error(`  ⚠️ Discogs error ${response.status} for ${releaseId}`);
        continue;
      }

      const releaseData: any = await response.json();
      const stats = releaseData.marketplace_stats;

      if (!stats) {
        console.warn(`  ⚠️ No marketplace stats for ${releaseId}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from("market_prices")
        .insert({
          release_id: releaseId.toString(),
          lowest_price: stats.lowest_price?.value || 0,
          median_price: stats.median_price?.value || 0,
          num_for_sale: stats.num_for_sale || 0,
          currency: stats.lowest_price?.currency || "EUR"
        });

      if (insertError) console.error(`  ❌ Supabase insert error:`, insertError);
      else console.log(`  ✅ Success: ${stats.median_price?.value || stats.lowest_price?.value || 0} EUR`);

    } catch (err) {
      console.error(`  ❌ Failed fetch for ${releaseId}:`, err);
    }

    // Rate limit: 1.2s delay to be safe
    await new Promise(r => setTimeout(r, 1200));
  }

  // 3. Create global snapshot
  console.log("📊 Calculating final collection value...");
  let allPrices: any[] = [];
  let fetchedPrices = 1000;
  let offsetPrices = 0;
  while (fetchedPrices === 1000) {
    const { data, error } = await supabase
      .from("market_prices")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offsetPrices, offsetPrices + 999);
    
    if (error) break;
    if (data) {
      allPrices = allPrices.concat(data);
      fetchedPrices = data.length;
      offsetPrices += 1000;
    } else {
      fetchedPrices = 0;
    }
  }

  const latestPricesMap = new Map();
  allPrices?.forEach(p => {
    if(!latestPricesMap.has(p.release_id)) {
      latestPricesMap.set(p.release_id, p.median_price || p.lowest_price || 0);
    }
  });
  
  const totalValue = Array.from(latestPricesMap.values()).reduce((a, b) => a + b, 0);
  console.log(`✨ Total Collection Value: ${totalValue.toFixed(2)} EUR`);

  const { error: snapError } = await supabase.from("collection_snapshots").insert({ total_value: totalValue });
  if (snapError) console.error("❌ Error saving snapshot:", snapError);
  else console.log("✅ Snapshot saved.");

  console.log("🏁 Global update finished successfully.");
}

runUpdate();
