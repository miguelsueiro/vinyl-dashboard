// scripts/backfill_previous_price.mjs
//
// Relleno único de latest_prices.previous_price a partir del histórico.
// Ejecutar una sola vez, después de scripts/add_previous_price.sql:
//
//   node scripts/backfill_previous_price.mjs
//
// A partir de ahí lo mantiene scripts/update-prices.ts en cada sincronización.
// Solo toca la columna previous_price; no modifica precios ni histórico.

import fs from "fs";
import path from "path";

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      if (!env[k]) env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const U = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

async function fetchAll(query) {
  let out = [], off = 0;
  for (;;) {
    const r = await fetch(`${U}/rest/v1/${query}&offset=${off}&limit=1000`, { headers: H });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const d = await r.json();
    out = out.concat(d);
    if (d.length < 1000) break;
    off += 1000;
  }
  return out;
}

const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;

console.log("Leyendo histórico de precios...");
const hist = await fetchAll("market_prices?select=release_id,median_price,lowest_price,created_at&order=created_at.desc");
console.log(`  ${hist.length} filas`);

// Segunda lectura más reciente de cada disco = el "precio anterior".
const vistos = new Map();
const anterior = new Map();
for (const p of hist) {
  const id = String(p.release_id);
  const n = (vistos.get(id) || 0) + 1;
  vistos.set(id, n);
  if (n === 2) anterior.set(id, redondear(p.median_price ?? p.lowest_price));
}

const actuales = await fetchAll("latest_prices?select=release_id,median_price,lowest_price");
console.log(`  ${actuales.length} discos en latest_prices`);

let escritos = 0, sinHistorial = 0, fallos = 0;
for (const fila of actuales) {
  const id = String(fila.release_id);
  // Sin segunda lectura, el anterior es el actual: la flecha queda "estable",
  // que es exactamente lo que debe decir cuando no hay con qué comparar.
  const prev = anterior.has(id) ? anterior.get(id) : redondear(fila.median_price ?? fila.lowest_price);
  if (!anterior.has(id)) sinHistorial++;

  const r = await fetch(`${U}/rest/v1/latest_prices?release_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: H, body: JSON.stringify({ previous_price: prev }),
  });
  if (r.ok) escritos++; else { fallos++; if (fallos <= 3) console.warn("  fallo:", id, r.status, await r.text()); }
}

console.log(`\nTERMINADO  escritos=${escritos}  sin_historial=${sinHistorial}  fallos=${fallos}`);
