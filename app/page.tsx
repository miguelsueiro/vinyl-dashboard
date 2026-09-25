import { createClient } from "@supabase/supabase-js";
import ClientDashboard from "./ui";
import { leerCatalogo } from "@/lib/datos";
import type { CarpetaInteligente } from "@/lib/types";
import { calcularFrescura } from "@/lib/fechas";

// Dinámica a propósito, aunque los datos vengan de caché.
//
// Prerenderizada, la cuadrícula deja de pintarse en el servidor: el dashboard
// lee los filtros de la URL con useSearchParams, que en una página estática no
// se resuelve hasta after de hidratar, así que el HTML se queda en la pantalla
// de carga. Lo que había que dejar de repetir en cada visita eran las
// consultas, no el renderizado: de eso se encarga leerCatalogo.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Las flechas de tendencia salen de latest_prices.previous_price, que mantiene
  // la sincronización nocturna. Antes se cargaban las 3.000 filas más recientes
  // de market_prices en cada visita: ~2,2 días de historia con 1.330 discos, y
  // pasando de ~1.500 dejaba de haber dos lecturas por disco, así que los que
  // caían fuera del corte marcaban "estable" sin haberlo estado.
  const [{ records, latestPrices, snapshots }, smartFoldersRes] = await Promise.all([
    leerCatalogo(),
    // Fuera de la caché: se crean y se borran desde la propia aplicación.
    supabase.from("smart_folders").select("*").order("created_at", { ascending: true }),
  ]);

  const smartFolders = (smartFoldersRes.data ?? []) as CarpetaInteligente[];

  // El último snapshot se escribe al terminar la sincronización, así que su
  // fecha es la señal de que hubo una pasada completa. Se calcula aquí, en el
  // servidor, para que el "hace X" no cambie entre el HTML y la hidratación.
  const ultimaSync = calcularFrescura(snapshots[snapshots.length - 1]?.created_at);

  return (
    <ClientDashboard
      ultimaSync={ultimaSync}
      latestPrices={latestPrices}
      records={records}
      snapshots={snapshots}
      initialSmartFolders={smartFolders}
    />
  );
}
