-- scripts/add_previous_price.sql
--
-- Guarda el precio de la lectura anterior junto al actual.
--
-- POR QUÉ:
--   La portada necesita, por cada disco, el precio de hoy y el de ayer, para
--   pintar la flecha de subida o bajada. El de hoy lo tiene en latest_prices;
--   el de ayer lo sacaba cargando las 3.000 filas más recientes de
--   market_prices en cada visita.
--
--   Eso son ~2,2 días de historia con 1.330 discos. Pasando de ~1.500 discos,
--   3.000 filas dejan de cubrir dos lecturas por disco, y los que caen fuera
--   del corte empiezan a marcar "estable" aunque hayan cambiado — sin avisar, y
--   dependiendo de en qué orden se insertaron esa noche.
--
--   Con esta columna la portada no carga histórico en absoluto: 3.000 filas
--   menos por visita, y el cálculo deja de depender del tamaño de la colección.
--
-- El histórico completo sigue en market_prices; esto es solo una copia del
-- último valor, para leer rápido.
--
-- NO borra ni modifica datos: añade una columna vacía. Se rellena con
-- scripts/backfill_previous_price.mjs y a partir de ahí la mantiene la
-- sincronización nocturna.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Run

alter table public.latest_prices add column if not exists previous_price numeric;

-- Comprobación: deben aparecer median_price, lowest_price y previous_price.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'latest_prices'
order by ordinal_position;
