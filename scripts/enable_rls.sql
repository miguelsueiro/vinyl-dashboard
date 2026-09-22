-- scripts/enable_rls.sql
--
-- Activa Row Level Security en todas las tablas.
--
-- QUÉ HACE:
--   * Lectura pública: el dashboard sigue funcionando igual para cualquiera.
--   * Escritura bloqueada para la anon key (la que viaja en el bundle del
--     navegador). Hasta ahora cualquiera podía borrar o reescribir la colección.
--   * La service role key ignora RLS, así que las Server Actions, el cron y el
--     script de GitHub Actions siguen escribiendo sin cambios.
--
-- ⚠️ EJECUTAR DESPUÉS de desplegar los cambios de código. Si se ejecuta antes,
--    guardar enlaces de streaming y las carpetas inteligentes dejan de funcionar
--    hasta que el deploy esté arriba.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- 1. Activar RLS
-- ---------------------------------------------------------------------------
alter table public.records               enable row level security;
alter table public.market_prices         enable row level security;
alter table public.latest_prices         enable row level security;
alter table public.collection_snapshots  enable row level security;
alter table public.smart_folders         enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Lectura pública (el dashboard es público)
--    Sin políticas de INSERT/UPDATE/DELETE, esas operaciones quedan denegadas
--    por defecto para anon. No hace falta prohibirlas explícitamente.
-- ---------------------------------------------------------------------------
drop policy if exists "lectura publica" on public.records;
create policy "lectura publica" on public.records
  for select to anon, authenticated using (true);

drop policy if exists "lectura publica" on public.market_prices;
create policy "lectura publica" on public.market_prices
  for select to anon, authenticated using (true);

drop policy if exists "lectura publica" on public.latest_prices;
create policy "lectura publica" on public.latest_prices
  for select to anon, authenticated using (true);

drop policy if exists "lectura publica" on public.collection_snapshots;
create policy "lectura publica" on public.collection_snapshots
  for select to anon, authenticated using (true);

drop policy if exists "lectura publica" on public.smart_folders;
create policy "lectura publica" on public.smart_folders
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Comprobación: rowsecurity debe ser true en las 5 tablas
-- ---------------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('records', 'market_prices', 'latest_prices',
                    'collection_snapshots', 'smart_folders')
order by tablename;

-- Y una política de SELECT por tabla (5 filas):
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename;
