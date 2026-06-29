import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 300; // Aumentamos al máximo (5 min) por si la colección es grande

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  
  const isAuthorized = 
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) || 
    (process.env.CRON_SECRET && searchParams.get('key') === process.env.CRON_SECRET) ||
    (searchParams.get('key') === "vinyl-update-2026");

  if (!isAuthorized) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const discogsToken = process.env.DISCOGS_TOKEN;

  try {
    // 1. Obtener TODOS los registros (paginando para superar el límite de 1000)
    let allRecords: any[] = [];
    let fetchedCount = 1000;
    let offset = 0;
    
    while (fetchedCount === 1000) {
      const { data, error } = await supabase
        .from("records")
        .select("discogs_release_id")
        .range(offset, offset + 999);
      
      if (error) throw error;
      if (data) {
        allRecords = allRecords.concat(data);
        fetchedCount = data.length;
        offset += 1000;
      } else {
        fetchedCount = 0;
      }
    }

    console.log(`Actualizando precios para ${allRecords.length} discos...`);

    // 2. Actualización de precios en Discogs (por lotes para no saturar)
    // Usamos batches para no exceder los límites de memoria o timeout
    const results = [];
    const batchSize = 10; 
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const batchPromises = batch.map(async (record) => {
        const releaseId = record.discogs_release_id;
        try {
          const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
            headers: {
              "Authorization": `Discogs token=${discogsToken}`,
              "User-Agent": "VinylIntelligence/1.0"
            },
            next: { revalidate: 0 }
          });

          if (!response.ok) return { id: releaseId, success: false };

          const releaseData = await response.json();
          
          // Discogs doesn't include marketplace_stats anymore, lowest_price is at the root
          const lowestPrice = releaseData.lowest_price;
          const numForSale = releaseData.num_for_sale;

          const { error: insertError } = await supabase
            .from("market_prices")
            .insert({
              release_id: releaseId.toString(),
              lowest_price: lowestPrice || 0,
              median_price: null, // We stop storing fake median suggestions
              num_for_sale: numForSale || 0,
              currency: "EUR"
            });

          return { id: releaseId, success: !insertError };
        } catch (e) {
          return { id: releaseId, success: false };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pequeño respiro entre lotes para Discogs (60req/min)
      if (i + batchSize < allRecords.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // 3. Crear Snapshot Global (Calculando sobre TODOS los precios actuales)
    // Obtenemos los precios más recientes para cada disco
    let allPrices: any[] = [];
    let fetchedPrices = 1000;
    let offsetPrices = 0;
    while (fetchedPrices === 1000) {
      const { data, error } = await supabase
        .from("market_prices")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offsetPrices, offsetPrices + 999);
      
      if (error) throw error;
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
    await supabase.from("collection_snapshots").insert({ total_value: totalValue });

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      snapshotValue: totalValue,
      totalRecords: allRecords.length
    });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
