import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const discogsToken = process.env.DISCOGS_TOKEN;
const discogsUsername = process.env.DISCOGS_USERNAME || "crackrecords";

if (!supabaseUrl || !supabaseKey || !discogsToken) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runUpdate() {
  console.log(`🚀 Starting Full Sync & Price Update for user: ${discogsUsername}`);
  
  // --- FASE 1: SINCRONIZACIÓN DE COLECCIÓN ---
  console.log("📥 Syncing collection from Discogs...");
  let discogsReleases: any[] = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const res = await fetch(`https://api.discogs.com/users/${discogsUsername}/collection/folders/0/releases?page=${page}&per_page=100`, {
        headers: { "Authorization": `Discogs token=${discogsToken}`, "User-Agent": "VinylIntelligenceSync/1.0" }
      });
      if (!res.ok) throw new Error(`Discogs Sync Error: ${res.status}`);
      const data: any = await res.json();
      discogsReleases = discogsReleases.concat(data.releases);
      totalPages = data.pagination.pages;
      page++;
      // Pequeño delay para no saturar en el sync
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`✅ Fetched ${discogsReleases.length} releases from Discogs.`);

    // Comparar e insertar nuevos
    for (const release of discogsReleases) {
      const releaseId = release.id;
      const info = release.basic_information;
      const notes = release.notes || [];
      const { data: existing } = await supabase.from("records").select("id").eq("discogs_release_id", releaseId).single();

      const guessCondition = (notes: any[]) => {
        const conditionKeywords = ["VG", "NM", "Mint", "Near Mint", "Very Good", "G+", "Fair", "Poor"];
        let media = notes.find((n: any) => n.field_id === 1)?.value;
        let sleeve = notes.find((n: any) => n.field_id === 2)?.value;
        if (!media) {
          const found = notes.find((n: any) => conditionKeywords.some(k => n.value?.includes(k)));
          media = found?.value;
        }
        return { media: media || "Desconocido", sleeve: sleeve || "Desconocido" };
      };

      const fullFormat = [info.formats?.[0]?.name, ...(info.formats?.[0]?.descriptions || [])].filter(Boolean).join(", ");
      const { media: vinylCond, sleeve: sleeveCond } = guessCondition(notes);

      if (!existing) {
        console.log(`✨ New release found: ${info.artists?.[0]?.name} - ${info.title}`);

        await supabase.from("records").insert({
          discogs_release_id: releaseId,
          artist: info.artists?.[0]?.name || "Unknown",
          title: info.title,
          year: info.year,
          label: info.labels?.[0]?.name,
          genre: info.genres?.[0],
          style: info.styles?.[0],
          format: fullFormat,
          cover_image: info.cover_image,
          condition_vinyl: vinylCond,
          condition_sleeve: sleeveCond
        });
      } else {
        // Actualizar el formato y las condiciones de discos existentes (por si se editan en Discogs)
        await supabase.from("records")
          .update({ 
            format: fullFormat,
            condition_vinyl: vinylCond,
            condition_sleeve: sleeveCond
          })
          .eq("discogs_release_id", releaseId);
      }
    }
  } catch (err) {
    console.error("❌ Sync Phase Failed:", err);
  }

  // --- FASE 2: ACTUALIZACIÓN DE PRECIOS ---
  console.log("📈 Starting price updates...");
  let statsSummary = { total: 0, success: 0, fallback: 0, noData: 0 };
  
  let allRecords: any[] = [];
  let fetchedCount = 1000;
  let offset = 0;
  
  while (fetchedCount === 1000) {
    const { data, error } = await supabase
      .from("records")
      .select("discogs_release_id, condition_vinyl")
      .range(offset, offset + 999);
    
    if (error) break;
    if (data) {
      allRecords = allRecords.concat(data);
      fetchedCount = data.length;
      offset += 1000;
    } else {
      fetchedCount = 0;
    }
  }

  statsSummary.total = allRecords.length;
  console.log(`📦 Processing prices for ${allRecords.length} records...`);

  // (Resto de la lógica de precios igual...)

  // Mapping de condiciones a llaves de Discogs
  const conditionMap: Record<string, string> = {
    "Mint (M)": "Mint (M)",
    "Near Mint (NM or M-)": "Near Mint (NM or M-)",
    "Very Good Plus (VG+)": "Very Good Plus (VG+)",
    "Very Good (VG)": "Very Good (VG)",
    "Good Plus (G+)": "Good Plus (G+)",
    "Good (G)": "Good (G)",
    "Fair (F)": "Fair (F)",
    "Poor (P)": "Poor (P)",
    "NM": "Near Mint (NM or M-)",
    "VG+": "Very Good Plus (VG+)",
    "VG": "Very Good (VG)",
    "M": "Mint (M)",
    "Mint": "Mint (M)",
    "Near Mint": "Near Mint (NM or M-)"
  };

  // 2. Update each record with Discogs rate limiting
  for (let i = 0; i < allRecords.length; i++) {
    const { discogs_release_id: releaseId, condition_vinyl: userCondition } = allRecords[i];
    console.log(`[${i+1}/${allRecords.length}] Updating ID ${releaseId} (${userCondition || "No condition"})...`);

    let success = false;
    let retries = 0;

    while (!success && retries < 2) {
      try {
        const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
          headers: { "Authorization": `Discogs token=${discogsToken}`, "User-Agent": "VinylIntelligenceApp/1.2" }
        });

        if (response.status === 429) {
          console.warn("  ⚠️ Rate limit hit (429). Waiting 60s...");
          await new Promise(r => setTimeout(r, 60000));
          retries++;
          continue;
        }

        const releaseData: any = await response.json();
        
        let lowestPrice = releaseData.marketplace_stats?.lowest_price?.value || releaseData.lowest_price || 0;
        let medianPrice = 0;
        let numForSale = releaseData.marketplace_stats?.num_for_sale || releaseData.num_for_sale || 0;
        let isUsingCondition = false;
        
        // Intentar obtener sugerencias para precisión por estado
        try {
          const suggestRes = await fetch(`https://api.discogs.com/marketplace/price_suggestions/${releaseId}`, {
            headers: { "Authorization": `Discogs token=${discogsToken}`, "User-Agent": "VinylIntelligenceApp/1.2" }
          });
          if (suggestRes.ok) {
            const suggestData: any = await suggestRes.json();
            
            // Prioridad 1: Usar la condición real del usuario
            const targetKey = conditionMap[userCondition || ""] || "Very Good Plus (VG+)";
            const conditionPrice = suggestData[targetKey]?.value;
            
            if (conditionPrice) {
              medianPrice = conditionPrice;
              isUsingCondition = true;
            } else {
              medianPrice = suggestData["Very Good Plus (VG+)"]?.value || suggestData["Near Mint (NM or M-)"]?.value || 0;
            }
          }
        } catch (e) {}

        // Fallback final de comunidad si todo lo anterior falla
        if (medianPrice === 0) {
          medianPrice = releaseData.community?.stats?.median?.value || releaseData.marketplace_stats?.median_price?.value || releaseData.median_price || 0;
        }

        if (medianPrice === 0) medianPrice = lowestPrice;

        if (medianPrice === 0) {
          statsSummary.noData++;
          console.warn(`  ⚠️ Silence for ${releaseId}.`);
          break;
        }

        const currency = "EUR"; 

        const { error: insertError } = await supabase
          .from("market_prices")
          .insert({
            release_id: releaseId.toString(),
            lowest_price: lowestPrice,
            median_price: medianPrice,
            num_for_sale: numForSale,
            currency: currency
          });

      // Upsert into latest_prices table for fast look‑up
      const { error: upsertError } = await supabase
        .from('latest_prices')
        .upsert({
          release_id: releaseId.toString(),
          median_price: medianPrice,
          lowest_price: lowestPrice,
          num_for_sale: numForSale,
          updated_at: new Date().toISOString()
        }, { onConflict: 'release_id' });

      if (upsertError) console.warn('⚠️ Upsert latest_prices error:', upsertError);

        if (insertError) {
          console.error(`  ❌ Supabase insert error:`, insertError);
        } else {
          if (!isUsingCondition) statsSummary.fallback++;
          else statsSummary.success++;
          console.log(`  ✅ Success: ${medianPrice} EUR (${isUsingCondition ? `Condition: ${userCondition}` : "Standard VG+"})`);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    console.log("🔄 Triggering on-demand cache revalidation...");
    const revalRes = await fetch(`${appUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: supabaseKey })
    });
    if (revalRes.ok) {
      console.log("✅ Cache successfully purged.");
    } else {
      console.warn("⚠️ Failed to purge cache:", revalRes.status);
    }
  } catch (err) {
    console.warn("⚠️ Could not reach revalidation endpoint:", err);
  }

  console.log("\n--- 🏁 MISSION SUMMARY ---");
  console.log(`📦 Total Records:    ${statsSummary.total}`);
  console.log(`✅ Real Medians:    ${statsSummary.success}`);
  console.log(`📉 Low Fallbacks:   ${statsSummary.fallback}`);
  console.log(`❓ No Data (0€):    ${statsSummary.noData}`);
  console.log("---------------------------\n");
}


runUpdate();
