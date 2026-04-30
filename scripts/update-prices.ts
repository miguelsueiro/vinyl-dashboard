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
  console.log(`Checking token: ${discogsToken ? `PRESENT (length: ${discogsToken.length})` : "MISSING"}`);

  let statsSummary = {
    total: 0,
    success: 0,
    fallback: 0,
    noData: 0
  };

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

  statsSummary.total = allRecords.length;
  console.log(`📦 Found ${allRecords.length} records. Processing...`);

  // 2. Update each record with Discogs rate limiting (60req/min -> ~1s per request)
  for (let i = 0; i < allRecords.length; i++) {
    const releaseId = allRecords[i].discogs_release_id;
    console.log(`[${i+1}/${allRecords.length}] Updating ID ${releaseId}...`);

    let success = false;
    let retries = 0;

    while (!success && retries < 2) {
      try {
        const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
          headers: {
            "Authorization": `Discogs token=${discogsToken}`,
            "User-Agent": "VinylIntelligence/1.0"
          }
        });

        if (response.status === 429) {
          console.warn("  ⚠️ Rate limit hit (429). Waiting 60 seconds...");
          await new Promise(r => setTimeout(r, 60000));
          retries++;
          continue;
        }

        if (!response.ok) {
          console.error(`  ⚠️ Discogs error ${response.status} for ${releaseId}`);
          break;
        }

        const releaseData: any = await response.json();
        
        // Diagnóstico profundo para discos sin precio
        const hasMarketplace = !!releaseData.marketplace_stats;
        const hasCommunity = !!releaseData.community?.stats;

        // 1. Intentar obtener de marketplace_stats (mercado actual)
        let lowestPrice = releaseData.marketplace_stats?.lowest_price?.value || releaseData.lowest_price || 0;
        let medianPrice = releaseData.marketplace_stats?.median_price?.value || releaseData.median_price || 0;
        let numForSale = releaseData.marketplace_stats?.num_for_sale || releaseData.num_for_sale || 0;
        
        // 2. BÚSQUEDA PROFUNDA
        if (medianPrice === 0) {
          if (releaseData.community?.stats) {
            // Logueamos el objeto stats para ver qué hay dentro exactamente
            console.log(`    DEBUG [Community Stats]: ${JSON.stringify(releaseData.community.stats)}`);
            medianPrice = releaseData.community.stats.median?.value || releaseData.community.stats.median || 0;
            lowestPrice = releaseData.community.stats.low?.value || releaseData.community.stats.low || lowestPrice;
          }
          if (medianPrice === 0 && releaseData.community?.rating?.stats) {
            console.log(`    DEBUG [Rating Stats]: ${JSON.stringify(releaseData.community.rating.stats)}`);
            medianPrice = releaseData.community.rating.stats.median?.value || releaseData.community.rating.stats.median || 0;
          }
        }

        // 3. Fallback final
        if (medianPrice === 0) medianPrice = lowestPrice;

        const currency = "EUR"; 

        if (medianPrice === 0) {
          statsSummary.noData++;
          console.warn(`  ⚠️ Total silence for ${releaseId}.`);
          console.log(`    DEBUG [Marketplace Object]: ${JSON.stringify(releaseData.marketplace_stats || "null")}`);
          console.log(`    DEBUG [Community Object]: ${JSON.stringify(releaseData.community || "null")}`);
          break;
        }

        const { error: insertError } = await supabase
          .from("market_prices")
          .insert({
            release_id: releaseId.toString(),
            lowest_price: lowestPrice,
            median_price: medianPrice,
            num_for_sale: numForSale,
            currency: currency
          });

        const isFallback = !releaseData.marketplace_stats?.median_price?.value && !releaseData.median_price;

        if (insertError) {
          console.error(`  ❌ Supabase insert error:`, insertError);
        } else {
          if (isFallback) statsSummary.fallback++;
          else statsSummary.success++;
          console.log(`  ✅ Success: ${medianPrice} EUR (${isFallback ? "Fallback" : "Median"})`);
        }
        
        success = true;

      } catch (err) {
        console.error(`  ❌ Failed fetch for ${releaseId}:`, err);
        break;
      }
    }

    // Base delay: 2s between requests
    await new Promise(r => setTimeout(r, 2000));
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
  
  const totalValue = Array.from(latestPricesMap.values()).reduce((a: any, b: any) => a + b, 0);
  console.log(`✨ Total Collection Value: ${totalValue.toFixed(2)} EUR`);

  const { error: snapError } = await supabase.from("collection_snapshots").insert({ total_value: totalValue });
  if (snapError) console.error("❌ Error saving snapshot:", snapError);
  else console.log("✅ Snapshot saved.");

  console.log("\n--- 🏁 MISSION SUMMARY ---");
  console.log(`📦 Total Records:    ${statsSummary.total}`);
  console.log(`✅ Real Medians:    ${statsSummary.success}`);
  console.log(`📉 Low Fallbacks:   ${statsSummary.fallback}`);
  console.log(`❓ No Data (0€):    ${statsSummary.noData}`);
  console.log("---------------------------\n");
}

runUpdate();
