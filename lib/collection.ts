/**
 * Filtrado, orden y navegación de la colección.
 *
 * Vive aquí porque lo necesitan DOS vistas: la portada (app/ui.tsx) y la ficha
 * de disco (app/release/[id]/page.tsx), que usa las mismas reglas para saber
 * cuál es el disco anterior y el siguiente.
 *
 * Antes cada una tenía su copia y se habían ido separando: la ficha ordenaba
 * solo por artista y año, así que con el orden por defecto (mayor precio) las
 * flechas llevaban a un disco distinto del que se veía en pantalla, y su
 * detección de formato no distinguía LP de 7". Si cambias una regla, cámbiala
 * aquí y las dos vistas siguen de acuerdo.
 */

export type GrupoFormato = "LP" | "10in" | "7in" | "CD" | "Cassette" | "Vinilo";

export type OrdenColeccion = "priceDesc" | "priceAsc" | "artistAsc" | "yearDesc";

export type VistaColeccion = "all" | "top10" | "rarezas";

export const ORDEN_POR_DEFECTO: OrdenColeccion = "priceDesc";
export const VISTA_POR_DEFECTO: VistaColeccion = "all";

/** Lo mínimo que necesita un disco para filtrarse y ordenarse. */
export interface ItemColeccion {
  release_id: string | number;
  price: number;
  record?: {
    artist?: string | null;
    title?: string | null;
    year?: string | number | null;
    genre?: string | null;
    style?: string | null;
    label?: string | null;
    format?: string | null;
    country?: string | null;
    condition_vinyl?: string | null;
    condition_sleeve?: string | null;
  } | null;
}

export interface FiltrosColeccion {
  search: string;
  genre: string;
  style: string;
  year: string;
  label: string;
  /** "all" o uno de GrupoFormato. */
  format: string;
  /** Estado exacto, o "__unknown__" para los que no tienen dato. */
  condition: string;
}

export const FILTROS_VACIOS: FiltrosColeccion = {
  search: "",
  genre: "",
  style: "",
  year: "",
  label: "",
  format: "all",
  condition: "",
};

/**
 * Agrupa el formato libre de Discogs ("Vinyl, LP, Album, Reissue") en las
 * categorías del desplegable. El orden de las comprobaciones importa: "CD" y
 * "Cassette" primero porque un LP nunca los menciona, y 12" cuenta como LP.
 */
export function grupoFormato(formatoBruto: string | null | undefined): GrupoFormato {
  const f = (formatoBruto || "").toLowerCase();
  if (f.includes("cd")) return "CD";
  if (f.includes("cassette")) return "Cassette";
  if (f.includes("lp") || f.includes('12"')) return "LP";
  if (f.includes('10"')) return "10in";
  if (f.includes('7"')) return "7in";
  return "Vinilo";
}

function contiene(valor: string | null | undefined, aguja: string): boolean {
  if (!aguja) return true;
  return (valor || "").toLowerCase().includes(aguja.trim().toLowerCase());
}

/**
 * Géneros y estilos llegan de Discogs como lista y se guardan en una sola
 * columna, unidos por este separador.
 *
 * Antes solo se guardaba el primero y se perdía el resto: 890 discos (el 67%)
 * tienen más de un estilo, y 52 de los 150 estilos reales no llegaban a existir
 * en la app.
 *
 * NO se puede usar la coma: Discogs tiene un género que se llama literalmente
 * "Folk, World, & Country" y partirlo por coma lo rompe en tres etiquetas falsas.
 * La barra tampoco vale (existe "Funk / Soul"). La barra vertical no aparece en
 * ninguno de los 165 valores de la colección, así que es la que se usa.
 */
export const SEPARADOR_MULTIVALOR = " | ";

export function separarTokens(valor: string | null | undefined): string[] {
  if (!valor) return [];
  return valor
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function unirTokens(valores: unknown): string | null {
  if (!Array.isArray(valores) || valores.length === 0) return null;
  const limpios = valores.map((v) => String(v).trim()).filter(Boolean);
  return limpios.length ? limpios.join(SEPARADOR_MULTIVALOR) : null;
}

/**
 * Coincidencia por token exacto, no por subcadena: eligiendo "Rock" en el
 * desplegable se quiere el género Rock, no todo lo que contenga esa palabra
 * (Punk Rock, Space Rock, Garage Rock...).
 */
function tieneToken(valor: string | null | undefined, buscado: string): boolean {
  if (!buscado) return true;
  const objetivo = buscado.trim().toLowerCase();
  return separarTokens(valor).some((t) => t.toLowerCase() === objetivo);
}

/** Todos los valores distintos de una columna multivalor, ordenados. */
export function tokensUnicos(
  items: Array<{ [k: string]: unknown }>,
  campo: string
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const t of separarTokens(item[campo] as string)) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function estadoSinDato(estado: string | null | undefined): boolean {
  return !estado || estado === "Desconocido";
}

export function cumpleFiltros(item: ItemColeccion, filtros: FiltrosColeccion): boolean {
  const r = item.record;

  const q = filtros.search.trim().toLowerCase();
  if (q) {
    const coincide =
      (r?.artist || "").toLowerCase().includes(q) ||
      (r?.title || "").toLowerCase().includes(q) ||
      String(item.release_id).includes(q);
    if (!coincide) return false;
  }

  // Género y estilo son multivalor: coincidencia por token exacto.
  if (!tieneToken(r?.genre, filtros.genre)) return false;
  if (!tieneToken(r?.style, filtros.style)) return false;
  // El sello es un texto libre y aquí sí interesa la subcadena.
  if (!contiene(r?.label, filtros.label)) return false;

  if (filtros.year && String(r?.year) !== filtros.year.trim()) return false;

  if (filtros.format && filtros.format !== "all") {
    if (grupoFormato(r?.format) !== filtros.format) return false;
  }

  if (filtros.condition === "__unknown__") {
    if (!estadoSinDato(r?.condition_vinyl) || !estadoSinDato(r?.condition_sleeve)) return false;
  } else if (filtros.condition) {
    const buscado = filtros.condition.toLowerCase();
    const coincide =
      (r?.condition_vinyl || "").toLowerCase() === buscado ||
      (r?.condition_sleeve || "").toLowerCase() === buscado;
    if (!coincide) return false;
  }

  return true;
}

/**
 * Devuelve una copia ordenada; no toca el array recibido.
 *
 * Todos los criterios desempatan por release_id. Sin eso el empate lo resolvía
 * el orden en que cada tabla devolvía las filas, y la portada (que lee de
 * latest_prices) y la ficha (que lee de records) llegaban a listas distintas:
 * con tres discos a 34,02 € la flecha "anterior" llevaba a otro sitio del que
 * se veía en pantalla.
 */
export function ordenarColeccion<T extends ItemColeccion>(items: T[], orden: OrdenColeccion): T[] {
  const porId = (a: ItemColeccion, b: ItemColeccion) => Number(a.release_id) - Number(b.release_id);

  const comparadores: Record<OrdenColeccion, (a: T, b: T) => number> = {
    priceDesc: (a, b) => b.price - a.price || porId(a, b),
    priceAsc: (a, b) => a.price - b.price || porId(a, b),
    artistAsc: (a, b) =>
      (a.record?.artist || "").localeCompare(b.record?.artist || "", "es") || porId(a, b),
    yearDesc: (a, b) =>
      ((parseInt(String(b.record?.year)) || 0) - (parseInt(String(a.record?.year)) || 0)) || porId(a, b),
  };

  const comparador = comparadores[orden];
  return comparador ? [...items].sort(comparador) : [...items];
}

/**
 * Reconstruye la lista que el usuario tenía delante y localiza los vecinos del
 * disco abierto. Devuelve null en los extremos.
 */
export function vecinos(
  items: ItemColeccion[],
  filtros: FiltrosColeccion,
  orden: OrdenColeccion,
  releaseId: string | number
): { anterior: number | null; siguiente: number | null; posicion: number; total: number } {
  const lista = ordenarColeccion(items.filter((i) => cumpleFiltros(i, filtros)), orden);
  const objetivo = Number(releaseId);
  const idx = lista.findIndex((i) => Number(i.release_id) === objetivo);

  if (idx === -1) {
    return { anterior: null, siguiente: null, posicion: -1, total: lista.length };
  }

  return {
    anterior: idx > 0 ? Number(lista[idx - 1].release_id) : null,
    siguiente: idx < lista.length - 1 ? Number(lista[idx + 1].release_id) : null,
    posicion: idx + 1,
    total: lista.length,
  };
}

/**
 * El contrato de la URL vive aquí, en un solo sitio.
 *
 * La portada escribe estos nueve parámetros y la ficha los lee para reconstruir
 * la lista. Cuando cada vista tenía su propia lista de nombres, la ficha enviaba
 * `search`, `format`, `condition`, `sort` y `view` y la portada solo leía cuatro:
 * al volver atrás se perdían los otros cinco.
 *
 * Acepta tanto el objeto plano de `searchParams` de un Server Component como el
 * `URLSearchParams` que devuelve `useSearchParams()` en cliente.
 */
type FuenteParams =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

function leerParam(sp: FuenteParams, clave: string): string {
  if (typeof (sp as { get?: unknown }).get === "function") {
    return (sp as { get(n: string): string | null }).get(clave) ?? "";
  }
  const v = (sp as Record<string, string | string[] | undefined>)[clave];
  return typeof v === "string" ? v : "";
}

export function filtrosDesdeParams(sp: FuenteParams): FiltrosColeccion {
  return {
    search: leerParam(sp, "search"),
    genre: leerParam(sp, "genre"),
    style: leerParam(sp, "style"),
    year: leerParam(sp, "year"),
    label: leerParam(sp, "label"),
    format: leerParam(sp, "format") || "all",
    condition: leerParam(sp, "condition"),
  };
}

export function ordenDesdeParams(sp: FuenteParams): OrdenColeccion {
  const v = leerParam(sp, "sort");
  const validos: OrdenColeccion[] = ["priceDesc", "priceAsc", "artistAsc", "yearDesc"];
  return validos.includes(v as OrdenColeccion) ? (v as OrdenColeccion) : ORDEN_POR_DEFECTO;
}

export function vistaDesdeParams(sp: FuenteParams): VistaColeccion {
  const v = leerParam(sp, "view");
  const validos: VistaColeccion[] = ["all", "top10", "rarezas"];
  return validos.includes(v as VistaColeccion) ? (v as VistaColeccion) : VISTA_POR_DEFECTO;
}

/**
 * Construye la query string a partir del estado. Es la contraparte exacta de las
 * funciones de lectura: lo que se escribe aquí es lo que se lee allí.
 *
 * Los valores por defecto se omiten para que la URL no se llene de ruido cuando
 * no hay ningún filtro puesto.
 */
export function construirQuery(
  filtros: FiltrosColeccion,
  orden: OrdenColeccion,
  vista: VistaColeccion
): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.search.trim()) params.set("search", filtros.search);
  if (filtros.genre) params.set("genre", filtros.genre);
  if (filtros.style) params.set("style", filtros.style);
  if (filtros.year) params.set("year", filtros.year);
  if (filtros.label) params.set("label", filtros.label);
  if (filtros.format && filtros.format !== "all") params.set("format", filtros.format);
  if (filtros.condition) params.set("condition", filtros.condition);
  if (orden !== ORDEN_POR_DEFECTO) params.set("sort", orden);
  if (vista !== VISTA_POR_DEFECTO) params.set("view", vista);
  return params;
}

/**
 * Precio de la lectura inmediatamente anterior, para la flecha de tendencia.
 *
 * `historial` debe venir ordenado de más reciente a más antiguo. Se redondea a
 * dos decimales antes de comparar: Discogs devuelve fracciones largas y sin
 * redondear aparecían subidas y bajadas de céntimas que no significaban nada.
 *
 * La ficha de disco usaba otra regla —el último precio DISTINTO, que podía ser
 * de hace meses— y presentaba esa diferencia como si fuera el último cambio, así
 * que el mismo disco contaba una historia en la portada y otra en su ficha.
 */
export function redondear(valor: unknown): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

export function calcularTendencia(
  precioActual: number,
  historial: Array<{ median_price?: unknown; lowest_price?: unknown }>
): { precioAnterior: number; tendencia: "up" | "down" | "stable" } {
  const anterior = historial.length > 1 ? historial[1] : null;
  const precioAnterior = anterior
    ? redondear(anterior.median_price ?? anterior.lowest_price)
    : precioActual;

  let tendencia: "up" | "down" | "stable" = "stable";
  if (precioActual > precioAnterior) tendencia = "up";
  else if (precioActual < precioAnterior) tendencia = "down";

  return { precioAnterior, tendencia };
}
