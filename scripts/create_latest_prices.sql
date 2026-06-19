-- migrations/create_latest_prices.sql
-- Tabla para guardar el precio más reciente de cada disco
CREATE TABLE IF NOT EXISTS latest_prices (
  release_id TEXT PRIMARY KEY,
  median_price NUMERIC,
  lowest_price NUMERIC,
  num_for_sale INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice opcional para ordenar rápidamente por precio
CREATE INDEX IF NOT EXISTS idx_latest_prices_median ON latest_prices (median_price DESC);
