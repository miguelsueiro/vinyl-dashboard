// scripts/check-rls.mjs
//
// Comprueba que la anon key (la que va en el bundle del navegador) puede LEER
// pero no ESCRIBIR. Ejecutar después de aplicar scripts/enable_rls.sql:
//
//   node scripts/check-rls.mjs
//
// Las escrituras de prueba apuntan a filas inexistentes: no modifican datos.

import fs from 'fs';
import path from 'path';

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const i = line.indexOf('=');
      const k = line.slice(0, i).trim();
      if (!env[k]) env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !ANON) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };
const TABLES = ['records', 'market_prices', 'latest_prices', 'collection_snapshots', 'smart_folders'];

let fail = 0;

console.log('LECTURA (debe funcionar: el dashboard es público)');
for (const t of TABLES) {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  const ok = r.status === 200;
  if (!ok) fail++;
  console.log(`  ${ok ? 'OK  ' : 'FALLO'}  ${t.padEnd(22)} ${r.status}`);
}

console.log('\nESCRITURA con anon key (debe estar BLOQUEADA)');
const writes = [
  ['UPDATE records', `records?discogs_release_id=eq.-1`, 'PATCH', JSON.stringify({ streaming_url: null })],
  ['DELETE smart_folders', `smart_folders?id=eq.00000000-0000-0000-0000-000000000000`, 'DELETE', undefined],
  ['INSERT market_prices', `market_prices`, 'POST', JSON.stringify({ release_id: '-1', median_price: 0 })],
  ['DELETE latest_prices', `latest_prices?release_id=eq.-1`, 'DELETE', undefined],
  ['INSERT collection_snapshots', `collection_snapshots`, 'POST', JSON.stringify({ total_value: 0 })],
];

for (const [label, q, method, body] of writes) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { method, headers: H, body });
  const blocked = r.status === 401 || r.status === 403;
  if (!blocked) fail++;
  console.log(`  ${blocked ? 'OK  ' : 'FALLO'}  ${label.padEnd(26)} ${r.status} ${blocked ? 'bloqueado' : '<-- PERMITIDO, RLS sigue abierta'}`);
}

console.log(fail === 0
  ? '\nTodo correcto: lectura pública, escritura bloqueada.'
  : `\n${fail} comprobación(es) fallida(s). Revisa scripts/enable_rls.sql.`);
process.exit(fail === 0 ? 0 : 1);
