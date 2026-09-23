// scripts/backfill_genres.mjs
//
// Relleno único de records.genre y records.style con TODOS los valores que da
// Discogs, no solo el primero. Ejecutar una vez:
//
//   node scripts/backfill_genres.mjs
//
// A partir de ahí lo mantiene scripts/update-prices.ts en cada sincronización.
//
// Es rápido: la colección entera viene en unas 14 peticiones al listado, no una
// por disco. Solo escribe cuando el valor cambia.

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
const T = env.DISCOGS_TOKEN;
const USER = env.DISCOGS_USERNAME || "crackrecords";
if (!U || !K || !T) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DISCOGS_TOKEN");
  process.exit(1);
}
const SB = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const DG = { Authorization: `Discogs token=${T}`, "User-Agent": "VinylGenreBackfill/1.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// " | " y no coma: existe el género "Folk, World, & Country". Ver lib/collection.ts.
const SEPARADOR = " | ";
const unir = (v) =>
  Array.isArray(v) && v.length
    ? v.map((x) => String(x).trim()).filter(Boolean).join(SEPARADOR) || null
    : null;

console.log("Leyendo la colección de Discogs...");
let releases = [], page = 1, pages = 1;
do {
  const r = await fetch(
    `https://api.discogs.com/users/${USER}/collection/folders/0/releases?page=${page}&per_page=100`,
    { headers: DG }
  );
  if (!r.ok) { console.error("Discogs devolvió", r.status); process.exit(1); }
  const d = await r.json();
  releases = releases.concat(d.releases);
  pages = d.pagination.pages;
  page++;
  await sleep(600);
} while (page <= pages);
console.log(`  ${releases.length} discos\n`);

console.log("Leyendo lo que hay guardado...");
let guardados = [], off = 0;
for (;;) {
  const r = await fetch(`${U}/rest/v1/records?select=discogs_release_id,genre,style&offset=${off}&limit=1000`, { headers: SB });
  const d = await r.json();
  guardados = guardados.concat(d);
  if (d.length < 1000) break;
  off += 1000;
}
const actual = new Map(guardados.map((r) => [Number(r.discogs_release_id), r]));
console.log(`  ${guardados.length} discos\n`);

let escritos = 0, sinCambio = 0, noEstaban = 0, fallos = 0;
for (const rel of releases) {
  const id = Number(rel.id);
  const prev = actual.get(id);
  if (!prev) { noEstaban++; continue; }

  const genre = unir(rel.basic_information?.genres);
  const style = unir(rel.basic_information?.styles);
  if (genre === prev.genre && style === prev.style) { sinCambio++; continue; }

  const w = await fetch(`${U}/rest/v1/records?discogs_release_id=eq.${id}`, {
    method: "PATCH", headers: SB, body: JSON.stringify({ genre, style }),
  });
  if (w.ok) escritos++; else { fallos++; if (fallos <= 3) console.warn("  fallo:", id, w.status, await w.text()); }
}

console.log(`TERMINADO  actualizados=${escritos}  sin_cambio=${sinCambio}  no_en_bd=${noEstaban}  fallos=${fallos}`);

// Reparto final
let todos = [], o2 = 0;
for (;;) {
  const d = await (await fetch(`${U}/rest/v1/records?select=genre,style&offset=${o2}&limit=1000`, { headers: SB })).json();
  todos = todos.concat(d);
  if (d.length < 1000) break;
  o2 += 1000;
}
const tok = (campo) => {
  const s = new Set();
  todos.forEach((r) => String(r[campo] || "").split("|").map((x) => x.trim()).filter(Boolean).forEach((x) => s.add(x)));
  return s;
};
console.log(`\ngéneros distintos ahora: ${tok("genre").size}`);
console.log(`estilos distintos ahora: ${tok("style").size}`);
