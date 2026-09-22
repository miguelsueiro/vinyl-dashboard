// scripts/check-rls.mjs
//
// Comprueba que la anon key (la que va en el bundle del navegador) puede LEER
// pero no ESCRIBIR. Ejecutar después de aplicar scripts/enable_rls.sql:
//
//   node scripts/check-rls.mjs
//
// CÓMO FUNCIONA (y por qué no basta con mirar el código de estado):
//   Con RLS activada y sin política de UPDATE, Postgres NO devuelve error:
//   simplemente no encuentra ninguna fila que el rol pueda modificar, y
//   PostgREST responde 204. Sin RLS, un UPDATE que no casa con nada responde
//   204 también. El código de estado, por tanto, no distingue los dos casos.
//
//   La prueba fiable es escribir sobre una fila REAL y contar cuántas
//   devuelve con Prefer: return=representation:
//     0 filas -> RLS está bloqueando  ✅
//     1 fila  -> la escritura pasó    ⚠️
//
//   Para no alterar datos, cada UPDATE reescribe una columna con el valor que
//   ya tenía. Es una operación sin efecto: si RLS estuviera abierta, el dato
//   queda exactamente igual.

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

// tabla -> [columna con la que hacer el UPDATE sin efecto, clave primaria]
const TABLES = [
  { table: 'records', col: 'streaming_url', pk: 'discogs_release_id' },
  { table: 'market_prices', col: 'currency', pk: 'id' },
  { table: 'latest_prices', col: 'num_for_sale', pk: 'release_id' },
  { table: 'collection_snapshots', col: 'total_value', pk: 'id' },
  { table: 'smart_folders', col: 'name', pk: 'id' },
];

let fail = 0;

console.log('LECTURA con anon key (debe funcionar: el dashboard es público)\n');
for (const { table } of TABLES) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers: H });
  const ok = r.status === 200;
  if (!ok) fail++;
  console.log(`  ${ok ? 'OK   ' : 'FALLO'}  ${table.padEnd(22)} ${r.status}`);
}

console.log('\nESCRITURA con anon key sobre una fila REAL (debe quedar en 0 filas)\n');
for (const { table, col, pk } of TABLES) {
  // 1. Coger una fila real y su valor actual
  const rowRes = await fetch(`${URL_}/rest/v1/${table}?select=${pk},${col}&limit=1`, { headers: H });
  const rows = await rowRes.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`  --     ${table.padEnd(22)} sin filas, no se puede probar`);
    continue;
  }
  const row = rows[0];

  // 2. Reescribir esa columna con el MISMO valor (operación sin efecto)
  const r = await fetch(`${URL_}/rest/v1/${table}?${pk}=eq.${encodeURIComponent(row[pk])}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ [col]: row[col] }),
  });

  let affected;
  if (r.status === 401 || r.status === 403) {
    affected = 0; // rechazado de plano
  } else {
    const back = await r.json().catch(() => []);
    affected = Array.isArray(back) ? back.length : 0;
  }

  const blocked = affected === 0;
  if (!blocked) fail++;
  console.log(
    `  ${blocked ? 'OK   ' : 'FALLO'}  ${table.padEnd(22)} ${String(r.status).padEnd(4)} ` +
    `${affected} fila(s) modificadas  ${blocked ? '-> bloqueado' : '-> PERMITIDO, RLS sigue abierta'}`
  );
}

console.log(
  fail === 0
    ? '\n✅ Todo correcto: lectura pública, escritura bloqueada.'
    : `\n⚠️ ${fail} comprobación(es) fallida(s). Revisa scripts/enable_rls.sql.`
);
process.exit(fail === 0 ? 0 : 1);
