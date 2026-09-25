import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Disco, PrecioActual, Snapshot } from "@/lib/types";

/**
 * El catálogo: los discos, sus precios y el histórico de valor.
 *
 * Cambia una vez al día, cuando pasa la sincronización nocturna, y aun así se
 * volvía a pedir entero en cada visita: la portada lo leía para pintarse y la
 * ficha de cada disco lo leía otra vez solo para saber cuál era el anterior y
 * cuál el siguiente. Unas 2.700 filas por página vista.
 *
 * Ahora se lee una vez y las dos páginas comparten el resultado. La
 * sincronización nocturna lo invalida al terminar, llamando a /api/revalidate;
 * los diez minutos son la red por si esa llamada falla.
 *
 * Las carpetas no entran aquí a propósito: son catorce filas y se crean y se
 * borran desde la propia aplicación, así que cachearlas obligaría a invalidar
 * en cada escritura para ahorrar una consulta diminuta.
 *
 * Sobre unstable_cache: Next 16 lo da por sustituido por la directiva
 * "use cache", que necesita activar cacheComponents en toda la aplicación.
 * Al probarlo, el prerender exige que los Server Components sean
 * deterministas y la pantalla de carga elige una cita al azar; devolverla al
 * cliente traería de vuelta el parpadeo que se arregló en su día. Esa
 * migración es un trabajo aparte.
 */
export const ETIQUETA_CATALOGO = "catalogo";

export interface Catalogo {
  records: Disco[];
  latestPrices: PrecioActual[];
  snapshots: Snapshot[];
}

const COLUMNAS_DISCO =
  "discogs_release_id, artist, title, year, label, genre, style, format, country, cover_image, condition_vinyl, condition_sleeve";
const COLUMNAS_PRECIO = "release_id, median_price, lowest_price, previous_price, num_for_sale";

function cliente() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Supabase corta en 1.000 filas y la colección pasa de eso. Si una página
 * fallase a medias se devolvería una lista incompleta —y las flechas de la
 * ficha saltarían discos sin avisar—, así que el error se propaga en vez de
 * quedarse en un console.error.
 */
async function todasLasFilas<T>(tabla: string, columnas: string): Promise<T[]> {
  const supabase = cliente();
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select(columnas).range(desde, desde + 999);
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    if (!data) break;
    filas.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return filas;
}

export const leerCatalogo = unstable_cache(
  async (): Promise<Catalogo> => {
    const supabase = cliente();
    const [records, latestPrices, snapshotsRes] = await Promise.all([
      todasLasFilas<Disco>("records", COLUMNAS_DISCO),
      todasLasFilas<PrecioActual>("latest_prices", COLUMNAS_PRECIO),
      supabase.from("collection_snapshots").select("*").order("created_at", { ascending: true }),
    ]);
    const snapshots = (snapshotsRes.data ?? []) as Snapshot[];
    // Solo aparece cuando se lee de verdad de Supabase. Si sale una vez por
    // visita, la caché no está funcionando.
    console.log(`📊 Catálogo leído de la base — discos: ${records.length}, precios: ${latestPrices.length}, snapshots: ${snapshots.length}`);
    return { records, latestPrices, snapshots };
  },
  [ETIQUETA_CATALOGO],
  { tags: [ETIQUETA_CATALOGO], revalidate: 600 }
);
