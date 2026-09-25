/**
 * Las formas que devuelve la base de datos y las que circulan por la interfaz.
 *
 * Están escritas a partir del esquema real de Supabase (ver scripts/*.sql), no
 * inventadas: los campos son opcionales o admiten null exactamente donde la
 * tabla los deja vacíos.
 */

import type { Fiabilidad } from "./confidence";

/** Fila de `records`: un disco de la colección. */
export interface Disco {
  id?: number;
  discogs_release_id: number;
  artist: string | null;
  title: string | null;
  year: number | string | null;
  label: string | null;
  /** Multivalor, separado por " | ". Ver separarTokens en lib/collection.ts. */
  genre: string | null;
  /** Multivalor, separado por " | ". */
  style: string | null;
  format: string | null;
  country: string | null;
  cover_image: string | null;
  condition_vinyl: string | null;
  condition_sleeve: string | null;
  streaming_url: string | null;
  notes?: string | null;
  created_at?: string;
}

/** Fila de `latest_prices`: el último precio conocido de cada disco. */
export interface PrecioActual {
  release_id: string;
  median_price: number | null;
  lowest_price: number | null;
  /** Lectura anterior, para la flecha de tendencia. */
  previous_price?: number | null;
  num_for_sale: number | null;
  updated_at?: string;
}

/** Fila de `market_prices`: el histórico completo. */
export interface PrecioHistorico {
  id?: number;
  release_id: string;
  median_price: number | null;
  lowest_price: number | null;
  highest_price?: number | null;
  num_for_sale?: number | null;
  currency?: string | null;
  created_at: string;
}

/** Fila de `collection_snapshots`: el valor total en un momento dado. */
export interface Snapshot {
  id?: number;
  total_value: number;
  total_records?: number | null;
  created_at: string;
}

/**
 * Lo que guarda una carpeta. Es un subconjunto de FiltrosColeccion (mismos
 * nombres de campo), así que cumpleFiltros las entiende sin traducir nada y
 * lo que hay filtrado en la portada se puede guardar tal cual.
 *
 * Solo aparecen las reglas que el usuario ha puesto: una carpeta sin ninguna
 * es todo el catálogo.
 */
export interface ReglasCarpeta {
  search?: string;
  artist?: string;
  genre?: string;
  style?: string;
  label?: string;
  country?: string;
  format?: string;
  condition?: string;
  yearMin?: string;
  yearMax?: string;
  priceMin?: string;
  priceMax?: string;
}

/** Fila de `smart_folders`. */
export interface CarpetaInteligente {
  id: string;
  name: string;
  rules: ReglasCarpeta;
  created_at?: string;
}

export type Tendencia = "up" | "down" | "stable";

/**
 * Lo que circula por la interfaz: el precio de un disco con su ficha, su
 * tendencia y su nivel de fiabilidad ya calculados. Lo construye app/ui.tsx y
 * lo consumen las demás vistas.
 */
export interface DiscoConPrecio extends PrecioActual {
  record?: Disco;
  /** Precio actual redondeado a dos decimales. */
  price: number;
  prevPrice: number;
  trend: Tendencia;
  confidence: Fiabilidad;
  isRare: boolean;
}

/** Igual que DiscoConPrecio pero con la puntuación de rareza añadida. */
export interface DiscoConRareza extends DiscoConPrecio {
  rareScore: number;
}

/**
 * Lo que usamos de la respuesta de /releases/{id} de Discogs.
 *
 * No es la respuesta completa —tiene decenas de campos— sino los que lee la
 * ficha de disco. Todo opcional: Discogs rellena unos u otros según la edición.
 */
export interface PistaDiscogs {
  position?: string;
  title?: string;
  duration?: string;
  /** "heading" marca una cara o sección, no una canción. */
  type_?: string;
}

export interface CreditoDiscogs {
  name?: string;
  role?: string;
}

export interface ReleaseDiscogs {
  id?: number;
  country?: string;
  released?: string;
  notes?: string;
  num_for_sale?: number;
  lowest_price?: number | null;
  labels?: Array<{ name?: string; catno?: string }>;
  tracklist?: PistaDiscogs[];
  extraartists?: CreditoDiscogs[];
}

/**
 * Lo que usa la sincronización de la respuesta de
 * /users/{user}/collection/folders/0/releases.
 *
 * `basic_information` es un resumen: para el país o el tracklist hay que pedir
 * la ficha completa del disco (ver ReleaseDiscogs).
 */
export interface NotaColeccion {
  /** Campo personalizado del usuario. Por convención 1 es el estado del disco
   *  y 2 el de la funda, pero los identificadores los define cada cuenta. */
  field_id?: number;
  value?: string;
}

export interface ItemColeccionDiscogs {
  id: number;
  notes?: NotaColeccion[];
  basic_information?: {
    title?: string;
    year?: number;
    cover_image?: string;
    artists?: Array<{ name?: string }>;
    labels?: Array<{ name?: string; catno?: string }>;
    genres?: string[];
    styles?: string[];
    formats?: Array<{ name?: string; descriptions?: string[] }>;
  };
}

/** Respuesta de /marketplace/price_suggestions/{id}: un precio por estado. */
export type SugerenciasPrecio = Record<string, { value?: number; currency?: string } | undefined>;
