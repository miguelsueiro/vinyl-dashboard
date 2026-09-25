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

/** Las cuatro secciones del dashboard. */
export type PestanaDashboard = "collection" | "folders" | "analytics" | "random";

export const ORDEN_POR_DEFECTO: OrdenColeccion = "priceDesc";
export const VISTA_POR_DEFECTO: VistaColeccion = "all";
export const PESTANA_POR_DEFECTO: PestanaDashboard = "collection";

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

/**
 * Un único modelo de filtro para toda la aplicación.
 *
 * Antes había dos: el de la colección (búsqueda, género, estilo, año como
 * valor suelto, sello, formato, estado) y el de las carpetas (artista, género,
 * estilo, sello, rango de años, rango de precios, país). Siete campos se
 * repetían, cada uno con su propia implementación, y las dos se habían ido
 * separando: al arreglar la coincidencia por token de los géneros hubo que
 * tocarlo en los dos sitios.
 *
 * Cada vista rellena los campos que enseña y deja el resto vacíos; el
 * comparador es el mismo.
 */
export interface FiltrosColeccion {
  search: string;
  artist: string;
  genre: string;
  style: string;
  label: string;
  country: string;
  /** "all" o uno de GrupoFormato. */
  format: string;
  /** Estado exacto, o "__unknown__" para los que no tienen dato. */
  condition: string;
  /** Años y precios como rango: en carpetas ya lo eran y en la colección era
   *  un valor suelto, así que no se podía pedir "los noventa". */
  yearMin: string;
  yearMax: string;
  priceMin: string;
  priceMax: string;
}

export const FILTROS_VACIOS: FiltrosColeccion = {
  search: "",
  artist: "",
  genre: "",
  style: "",
  label: "",
  country: "",
  format: "all",
  condition: "",
  yearMin: "",
  yearMax: "",
  priceMin: "",
  priceMax: "",
};

/** Construye unos filtros completos a partir de los campos que se quieran fijar. */
export function filtros(parciales: Partial<FiltrosColeccion>): FiltrosColeccion {
  return { ...FILTROS_VACIOS, ...parciales };
}

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
export function tokensUnicos<T>(items: T[], campo: keyof T): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const t of separarTokens(item[campo] as string | null | undefined)) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function estadoSinDato(estado: string | null | undefined): boolean {
  return !estado || estado === "Desconocido";
}

/**
 * Cómo se lee un rango en un chip: "1994", "desde 1994", "hasta 1999" o
 * "1994–1999". Un rango abierto por un lado es la mitad de los casos.
 */
/**
 * Las opciones de formato y estado, en un solo sitio.
 *
 * Estaban escritas a mano en la barra de filtros. Al añadirlas también al
 * modal de carpetas se colaron un "EP" y un "Single" que grupoFormato no
 * devuelve nunca: habrían sido dos filtros que no encuentran nada.
 */
/** Valor especial del filtro de estado: los discos sin dato en Discogs. */
export const ESTADO_SIN_DATO = "__unknown__";

export const OPCIONES_FORMATO: Array<{ valor: string; etiqueta: string }> = [
  { valor: "LP", etiqueta: "LP" },
  { valor: "10in", etiqueta: '10"' },
  { valor: "7in", etiqueta: '7"' },
  { valor: "CD", etiqueta: "CD" },
  { valor: "Cassette", etiqueta: "Cassette" },
  { valor: "Vinilo", etiqueta: "Otros vinilos" },
];

export const OPCIONES_ESTADO: Array<{ valor: string; etiqueta: string }> = [
  { valor: "Mint (M)", etiqueta: "Mint (M)" },
  { valor: "Near Mint (NM or M-)", etiqueta: "Near Mint (NM)" },
  { valor: "Very Good Plus (VG+)", etiqueta: "Very Good Plus (VG+)" },
  { valor: "Very Good (VG)", etiqueta: "Very Good (VG)" },
  { valor: "Good Plus (G+)", etiqueta: "Good Plus (G+)" },
  { valor: "Good (G)", etiqueta: "Good (G)" },
  { valor: "Fair (F)", etiqueta: "Fair (F)" },
  { valor: "Poor (P)", etiqueta: "Poor (P)" },
  { valor: ESTADO_SIN_DATO, etiqueta: "Sin datos en Discogs" },
];

export function etiquetaRango(min: string, max: string): string {
  if (min && max) return min === max ? min : `${min}–${max}`;
  if (min) return `desde ${min}`;
  if (max) return `hasta ${max}`;
  return "";
}

export function cumpleFiltros(item: ItemColeccion, f: FiltrosColeccion): boolean {
  const r = item.record;

  const q = f.search.trim().toLowerCase();
  if (q) {
    const coincide =
      (r?.artist || "").toLowerCase().includes(q) ||
      (r?.title || "").toLowerCase().includes(q) ||
      String(item.release_id).includes(q);
    if (!coincide) return false;
  }

  // Artista y sello son texto libre: interesa la subcadena.
  if (!contiene(r?.artist, f.artist)) return false;
  if (!contiene(r?.label, f.label)) return false;
  if (!contiene(r?.country, f.country)) return false;

  // Género y estilo son multivalor: coincidencia por token exacto.
  if (!tieneToken(r?.genre, f.genre)) return false;
  if (!tieneToken(r?.style, f.style)) return false;

  if (f.yearMin || f.yearMax) {
    const anio = parseInt(String(r?.year), 10);
    // Sin año no se puede saber si cae en el rango: queda fuera.
    if (Number.isNaN(anio)) return false;
    if (f.yearMin && anio < parseInt(f.yearMin, 10)) return false;
    if (f.yearMax && anio > parseInt(f.yearMax, 10)) return false;
  }

  if (f.priceMin && item.price < parseFloat(f.priceMin)) return false;
  if (f.priceMax && item.price > parseFloat(f.priceMax)) return false;

  if (f.format && f.format !== "all") {
    if (grupoFormato(r?.format) !== f.format) return false;
  }

  if (f.condition === ESTADO_SIN_DATO) {
    if (!estadoSinDato(r?.condition_vinyl) || !estadoSinDato(r?.condition_sleeve)) return false;
  } else if (f.condition) {
    const buscado = f.condition.toLowerCase();
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
  // Los enlaces antiguos llevaban ?year=1994, un valor suelto. Se sigue
  // entendiendo como un rango de un solo año para no romperlos.
  const anioSuelto = leerParam(sp, "year");

  return {
    search: leerParam(sp, "search"),
    artist: leerParam(sp, "artist"),
    genre: leerParam(sp, "genre"),
    style: leerParam(sp, "style"),
    label: leerParam(sp, "label"),
    country: leerParam(sp, "country"),
    format: leerParam(sp, "format") || "all",
    condition: leerParam(sp, "condition"),
    yearMin: leerParam(sp, "yearMin") || anioSuelto,
    yearMax: leerParam(sp, "yearMax") || anioSuelto,
    priceMin: leerParam(sp, "priceMin"),
    priceMax: leerParam(sp, "priceMax"),
  };
}

export function ordenDesdeParams(sp: FuenteParams): OrdenColeccion {
  const v = leerParam(sp, "sort");
  const validos: OrdenColeccion[] = ["priceDesc", "priceAsc", "artistAsc", "yearDesc"];
  return validos.includes(v as OrdenColeccion) ? (v as OrdenColeccion) : ORDEN_POR_DEFECTO;
}

export function pestanaDesdeParams(sp: FuenteParams): PestanaDashboard {
  const v = leerParam(sp, "tab");
  const validos: PestanaDashboard[] = ["collection", "folders", "analytics", "random"];
  return validos.includes(v as PestanaDashboard) ? (v as PestanaDashboard) : PESTANA_POR_DEFECTO;
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
  vista: VistaColeccion,
  pestana: PestanaDashboard = PESTANA_POR_DEFECTO
): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.search.trim()) params.set("search", filtros.search);
  if (filtros.genre) params.set("genre", filtros.genre);
  if (filtros.style) params.set("style", filtros.style);
  if (filtros.artist) params.set("artist", filtros.artist);
  if (filtros.country) params.set("country", filtros.country);
  // Un solo año se escribe como ?year= para que la URL no cargue con dos
  // parámetros que dicen lo mismo.
  if (filtros.yearMin && filtros.yearMin === filtros.yearMax) {
    params.set("year", filtros.yearMin);
  } else {
    if (filtros.yearMin) params.set("yearMin", filtros.yearMin);
    if (filtros.yearMax) params.set("yearMax", filtros.yearMax);
  }
  if (filtros.priceMin) params.set("priceMin", filtros.priceMin);
  if (filtros.priceMax) params.set("priceMax", filtros.priceMax);
  if (filtros.label) params.set("label", filtros.label);
  if (filtros.format && filtros.format !== "all") params.set("format", filtros.format);
  if (filtros.condition) params.set("condition", filtros.condition);
  if (orden !== ORDEN_POR_DEFECTO) params.set("sort", orden);
  if (vista !== VISTA_POR_DEFECTO) params.set("view", vista);
  if (pestana !== PESTANA_POR_DEFECTO) params.set("tab", pestana);
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

/**
 * Cuánto ha cambiado un precio respecto a la lectura anterior.
 *
 * La tarjeta enseñaba el precio ANTERIOR junto a la flecha, lo que se leía como
 * si esa fuera la cifra que había subido. Lo que interesa es la diferencia.
 *
 * El porcentaje es null cuando no hay con qué compararlo (precio anterior a
 * cero), para no enseñar un infinito.
 */
export function variacion(actual: number, anterior: number): {
  absoluta: number;
  porcentaje: number | null;
  /** Ya formateado y con signo, o null si no hay nada que enseñar. */
  etiquetaPorcentaje: string | null;
} {
  const absoluta = redondear(actual - anterior);
  const porcentaje = anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null;

  let etiquetaPorcentaje: string | null = null;
  if (porcentaje !== null && absoluta !== 0) {
    // El signo lo marca el cambio real, no el porcentaje redondeado: una subida
    // de un céntimo sobre 793 € redondea a 0 y salía como "−0 %".
    const signo = absoluta > 0 ? "+" : "−";
    etiquetaPorcentaje = porcentaje === 0
      ? `${signo}menos de 0,1 %`
      : `${signo}${Math.abs(porcentaje).toLocaleString("es-ES")} %`;
  }

  return { absoluta, porcentaje, etiquetaPorcentaje };
}

/** "+3,20 €" / "−1,05 €". Con el signo delante, que es lo que se busca al leerlo. */
export function formatearDelta(valor: number): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  const abs = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Math.abs(valor));
  return `${signo}${abs}`;
}
