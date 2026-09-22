-- scripts/enable_rls.sql
--
-- Activa Row Level Security en todas las tablas.
--
-- QUÉ HACE:
--   * Lectura pública: el dashboard sigue funcionando igual para cualquiera.
--   * Escritura bloqueada para la anon key (la que viaja en el bundle del
--     navegador). Sin esto, cualquiera puede borrar o reescribir la colección.
--   * La service role key ignora RLS, así que las Server Actions, el cron y el
--     script de GitHub Actions siguen escribiendo sin cambios.
--
-- POR QUÉ BORRA LAS POLÍTICAS EXISTENTES:
--   Alguna tabla (smart_folders) arrastra una política antigua de "permitir
--   todo", creada cuando la app escribía con la anon key. Mientras siga ahí,
--   activar RLS no sirve de nada: la política le da permiso igualmente. Por eso
--   se eliminan todas y se deja una sola de solo lectura.
--
--   Las políticas son reglas de permisos, NO datos. Borrarlas no toca ninguna
--   fila. Este script es idempotente: se puede ejecutar las veces que haga falta.
--
-- ⚠️ EJECUTAR DESPUÉS de desplegar los cambios de código.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Run

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'records', 'market_prices', 'latest_prices',
    'collection_snapshots', 'smart_folders'
  ]
  loop
    -- 1. Eliminar cualquier política previa, se llame como se llame
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
      raise notice 'Eliminada política % de %', p.policyname, t;
    end loop;

    -- 2. Activar RLS
    execute format('alter table public.%I enable row level security', t);

    -- 3. Dejar solo lectura pública (sin políticas de INSERT/UPDATE/DELETE,
    --    esas operaciones quedan denegadas por defecto para anon)
    execute format(
      'create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Comprobación 1: rowsecurity debe ser true en las 5 tablas
-- ---------------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('records', 'market_prices', 'latest_prices',
                    'collection_snapshots', 'smart_folders')
order by tablename;

-- ---------------------------------------------------------------------------
-- Comprobación 2: exactamente una política por tabla, y todas de SELECT.
-- Si aparece alguna con cmd distinto de SELECT, algo no ha ido bien.
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename;
