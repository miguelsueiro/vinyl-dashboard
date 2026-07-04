const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/['"]/g, '');
const discogsToken = env.match(/DISCOGS_TOKEN=(.*)/)[1].trim().replace(/['"]/g, '');

const supabase = createClient(url, key);

async function run() {
  const affectedReleaseIds = [3971479, 732580, 117527, 3773078, 4010143, 5062083];
  
  const { data: records, error: err2 } = await supabase
    .from('records')
    .select('discogs_release_id, artist, title, condition_vinyl')
    .in('discogs_release_id', affectedReleaseIds);
    
  if (err2) throw err2;

  const getConditionMultiplier = (condition) => {
    if (!condition) return 1.0;
    if (condition.includes("Mint (M)")) return 3.0;
    if (condition.includes("Near Mint") || condition.includes("NM") || condition.includes("M-")) return 2.5;
    if (condition.includes("Very Good Plus") || condition.includes("VG+")) return 2.0;
    if (condition.includes("Very Good") || condition.includes("VG")) return 1.5;
    return 1.0; // Good, Fair, Poor
  };

  for (const record of records) {
    const releaseId = record.discogs_release_id;
    const condition = record.condition_vinyl || "Very Good Plus (VG+)"; // Default fallback
    console.log(`Processing ${record.artist} - ${record.title} (${condition})`);
    try {
      // 1. Get real lowest price
      const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
        headers: { "Authorization": `Discogs token=${discogsToken}`, "User-Agent": "VinylIntelligence/1.1" },
        next: { revalidate: 0 }
      });
      
      if (!response.ok) {
        console.log('Failed to fetch release', response.status);
        continue;
      }
      const releaseData = await response.json();
      const lowestPrice = releaseData.lowest_price || 0;
      const numForSale = releaseData.num_for_sale || 0;

      // 2. Get price suggestions for median calculation
      let finalMedianPrice = lowestPrice; 
      try {
         const suggestRes = await fetch(`https://api.discogs.com/marketplace/price_suggestions/${releaseId}`, {
           headers: { "Authorization": `Discogs token=${discogsToken}`, "User-Agent": "VinylIntelligence/1.1" }
         });
         if (suggestRes.ok) {
            const suggestData = await suggestRes.json();
            const mintValue = suggestData["Mint (M)"]?.value || 0;
            
            // Detect the fake algorithmic curve
            const isFakeCurve = Math.abs(mintValue - 120.175) < 0.1 || Math.abs(mintValue - 107.525) < 0.1;
            
            if (isFakeCurve) {
               // Apply multiplier to real lowest price
               const multiplier = getConditionMultiplier(condition);
               finalMedianPrice = lowestPrice * multiplier;
               console.log(`  [FAKE CURVE DETECTED] Lowest: ${lowestPrice}, Multiplier: ${multiplier}x -> Median: ${finalMedianPrice}`);
            } else {
               // Use real suggestion matched to condition, fallback to VG+
               finalMedianPrice = suggestData[condition]?.value || suggestData["Very Good Plus (VG+)"]?.value || suggestData["Near Mint (NM or M-)"]?.value || lowestPrice;
               console.log(`  [REAL CURVE] Median: ${finalMedianPrice}`);
            }
         }
      } catch (err) {
        console.error('Suggest error', err);
      }

      const { error: insertError } = await supabase
        .from("market_prices")
        .insert({
          release_id: releaseId.toString(),
          lowest_price: lowestPrice,
          median_price: finalMedianPrice,
          num_for_sale: numForSale,
          currency: "EUR"
        });
      
      console.log(`  Inserted: ${!insertError ? 'Yes' : 'No'}`);
    } catch(e) {
      console.error(e);
    }
  }
}
run();
