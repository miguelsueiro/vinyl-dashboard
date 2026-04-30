import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60; // Máximo permitido en Vercel Pro, en Hobby intentará llegar a 10s

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  
  // Clave de seguridad: puede ser la automática de Vercel (CRON_SECRET) 
  // o una manual que tú definas (ej: VITE_UPDATE_KEY)
  const expectedToken = process.env.CRON_SECRET || process.env.UPDATE_KEY || "vinyl-update-2026";
  
  const isVercelCron = authHeader === `Bearer ${expectedToken}`;
  const isManualRun = searchParams.get('key') === expectedToken;

  if (!isVercelCron && !isManualRun) {
    console.error("Acceso denegado a la API de actualización.");
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Necesario para saltarse RLS si existiera
  );

  const discogsToken = process.env.DISCOGS_TOKEN;

  try {
    // 1. Obtener todos los IDs de la colección
    const { data: records, error: fetchError } = await supabase
      .from("records")
      .select("discogs_release_id");

    if (fetchError) throw fetchError;

    console.log(`Iniciando actualización de ${records.length} discos...`);

    // 2. Actualizar precios (en paralelo pero con cuidado por el rate limit de Discogs: 60req/min)
    // Para 40-50 discos, podemos lanzarlos casi todos de golpe si el timeout lo permite
    const results = await Promise.all(records.map(async (record) => {
      const releaseId = record.discogs_release_id;
      try {
        const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
          headers: {
            "Authorization": `Discogs token=${discogsToken}`,
            "User-Agent": "VinylIntelligence/1.0"
          },
          next: { revalidate: 0 } // Evitar cache de Next.js
        });

        if (!response.ok) return { id: releaseId, success: false, error: response.status };

        const releaseData = await response.json();
        const stats = releaseData.marketplace_stats;

        if (!stats) return { id: releaseId, success: false, error: "No stats" };

        const { error: insertError } = await supabase
          .from("market_prices")
          .insert({
            release_id: releaseId.toString(),
            lowest_price: stats.lowest_price?.value || 0,
            median_price: stats.median_price?.value || 0,
            num_for_sale: stats.num_for_sale || 0,
            currency: stats.lowest_price?.currency || "EUR"
          });

        return { id: releaseId, success: !insertError };
      } catch (e) {
        return { id: releaseId, success: false, error: "Fetch error" };
      }
    }));

    // 3. Crear Snapshot Global de la colección (para la gráfica de tendencia)
    const { data: prices } = await supabase
      .from("market_prices")
      .select("*")
      .order("created_at", { ascending: false });

    const uniquePrices = new Map();
    prices?.forEach(p => {
      if(!uniquePrices.has(p.release_id)) {
        uniquePrices.set(p.release_id, p.median_price || p.lowest_price || 0);
      }
    });
    
    const totalValue = Array.from(uniquePrices.values()).reduce((a: any, b: any) => a + b, 0);
    await supabase.from("collection_snapshots").insert({ total_value: totalValue });

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      snapshotValue: totalValue
    });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
