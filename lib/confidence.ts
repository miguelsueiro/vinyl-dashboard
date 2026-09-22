/**
 * Fiabilidad de un precio.
 *
 * El precio que guardamos es la sugerencia de Discogs para el estado del disco.
 * Discogs devuelve UN solo número por referencia y lo reparte entre los ocho
 * estados con una curva fija — [0.05, 0.10, 0.15, 0.25, 0.45, 0.65, 0.85, 0.95]
 * multiplicada por una escala — así que no hay dato de mercado por estado, y no
 * viene ninguna medida de confianza con él.
 *
 * Lo que sí sabemos son dos cosas, y de ahí sale el semáforo:
 *
 *   1. Cuántas copias hay a la venta ahora mismo (num_for_sale). Con muchas, la
 *      estimación está contrastada; con una o ninguna, es un recuerdo de ventas
 *      viejas.
 *   2. Si conocemos el estado del disco. Cuando no, el precio cae a Very Good
 *      Plus por defecto, y un grado de diferencia mueve el valor cerca de un 30%.
 *
 * Medido sobre la colección el 22/09/2026: el 60% del valor es "firme", un 21%
 * descansa sobre discos con dos copias o menos a la venta.
 */

/** Copias a la venta a partir de las cuales consideramos el mercado contrastado. */
export const COPIAS_MERCADO_FIRME = 5;

export type NivelFiabilidad = "firme" | "orientativo" | "dudoso";

export interface Fiabilidad {
  nivel: NivelFiabilidad;
  /** Etiqueta corta para la interfaz. */
  etiqueta: string;
  /** Explicación en una frase de por qué ese nivel. */
  motivo: string;
  copias: number;
  estadoConocido: boolean;
}

const ETIQUETAS: Record<NivelFiabilidad, string> = {
  firme: "Firme",
  orientativo: "Orientativo",
  dudoso: "Dudoso",
};

/** Discogs no siempre trae el estado; el sync lo guarda así cuando no lo encuentra. */
function esEstadoConocido(estado: unknown): boolean {
  if (typeof estado !== "string") return false;
  const limpio = estado.trim();
  return limpio !== "" && limpio !== "Desconocido";
}

export function getFiabilidad(numForSale: unknown, estadoVinilo: unknown): Fiabilidad {
  const copias = Math.max(0, Math.trunc(Number(numForSale) || 0));
  const estadoConocido = esEstadoConocido(estadoVinilo);

  let nivel: NivelFiabilidad;
  const motivos: string[] = [];

  if (copias === 0) {
    nivel = "dudoso";
    motivos.push("nadie lo vende ahora mismo");
  } else if (copias < COPIAS_MERCADO_FIRME) {
    nivel = "orientativo";
    motivos.push(copias === 1 ? "solo 1 copia a la venta" : `solo ${copias} copias a la venta`);
  } else {
    nivel = "firme";
    motivos.push(`${copias} copias a la venta`);
  }

  // Un estado sin registrar nunca puede dar un precio firme: se asume VG+.
  if (!estadoConocido) {
    if (nivel === "firme") nivel = "orientativo";
    motivos.push("estado sin registrar, se asume VG+");
  }

  const motivo = motivos.join(" · ");

  return {
    nivel,
    etiqueta: ETIQUETAS[nivel],
    motivo: motivo.charAt(0).toUpperCase() + motivo.slice(1),
    copias,
    estadoConocido,
  };
}

export interface ResumenFiabilidad {
  firme: { discos: number; valor: number };
  orientativo: { discos: number; valor: number };
  dudoso: { discos: number; valor: number };
  discos: number;
  valor: number;
}

/**
 * Reparte una colección por nivel de fiabilidad. Sirve para responder
 * "de estos 51.000 €, ¿cuántos me puedo creer?".
 */
export function resumirFiabilidad(
  items: Array<{ price?: number; confidence?: Fiabilidad }>
): ResumenFiabilidad {
  const resumen: ResumenFiabilidad = {
    firme: { discos: 0, valor: 0 },
    orientativo: { discos: 0, valor: 0 },
    dudoso: { discos: 0, valor: 0 },
    discos: 0,
    valor: 0,
  };

  for (const item of items) {
    const nivel = item.confidence?.nivel;
    if (!nivel) continue;
    const valor = Number(item.price) || 0;
    resumen[nivel].discos += 1;
    resumen[nivel].valor += valor;
    resumen.discos += 1;
    resumen.valor += valor;
  }

  return resumen;
}
