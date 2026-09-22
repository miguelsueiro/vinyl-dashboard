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

  if (!contiene(r?.genre, filtros.genre)) return false;
  if (!contiene(r?.style, filtros.style)) return false;
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

/** Lee los filtros de la query string, con los mismos nombres que usa la portada. */
export function filtrosDesdeParams(
  sp: Record<string, string | string[] | undefined>
): FiltrosColeccion {
  const leer = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  return {
    search: leer("search"),
    genre: leer("genre"),
    style: leer("style"),
    year: leer("year"),
    label: leer("label"),
    format: leer("format") || "all",
    condition: leer("condition"),
  };
}

export function ordenDesdeParams(
  sp: Record<string, string | string[] | undefined>
): OrdenColeccion {
  const v = sp["sort"];
  const valido: OrdenColeccion[] = ["priceDesc", "priceAsc", "artistAsc", "yearDesc"];
  return valido.includes(v as OrdenColeccion) ? (v as OrdenColeccion) : "priceDesc";
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
