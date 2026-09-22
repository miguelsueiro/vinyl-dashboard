-- scripts/add_country_column.sql
--
-- Añade la columna que le falta a records para que funcione el filtro de país
-- de las carpetas inteligentes.
--
-- El filtro se añadió en julio (commit 502cdf1) pero nunca llegó a funcionar:
-- la interfaz lee records.country y esa columna no existía, así que el
-- desplegable salía siempre vacío y cualquier carpeta con regla de país no
-- encontraba ningún disco.
--
-- NO borra ni modifica datos: solo añade una columna vacía. Se rellena sola en
-- la siguiente sincronización nocturna, que ya pide a Discogs la ficha completa
-- de cada disco (donde viene el país) para calcular el precio.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Run

alter table public.records add column if not exists country text;

-- Acelera el desplegable de países y el filtrado por país.
create index if not exists idx_records_country on public.records (country);

-- Comprobación: debe aparecer la columna country.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'records'
order by ordinal_position;
