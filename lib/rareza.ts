/**
 * Qué se considera raro, en un solo sitio.
 *
 * Había dos definiciones distintas conviviendo y dando listas distintas:
 *
 *   - La vista "Rarezas" pedía 40 € o más Y cero copias a la venta. Un corte
 *     duro: un disco de 793 € con dos copias no entraba, y uno de 41 € sin
 *     oferta sí.
 *   - El "Índice de Rareza" de Insights ordenaba por precio entre copias, que
 *     es una escala continua, y enseñaba el resultado como "Score: 12.4", un
 *     número que no significa nada para quien lo lee.
 *
 * Se queda la segunda, que es la que mide lo que importa —caro y difícil de
 * encontrar—, y la vista "Rarezas" pasa a ser un umbral sobre ella.
 */

/**
 * Precio entre copias a la venta.
 *
 * El +0,5 evita dividir por cero, que es justo el caso más escaso: sin él, un
 * disco que no vende nadie daría infinito.
 */
export function puntuacionRareza(precio: number, copias: unknown): number {
  const n = Math.max(0, Number(copias) || 0);
  return (Number(precio) || 0) / (n + 0.5);
}

/**
 * Umbral de la vista "Rarezas".
 *
 * Medido sobre la colección el 23/09/2026: deja 33 discos (el 2,5%). Con la
 * definición anterior eran 22, y los 11 que entran son los más valiosos que
 * quedaban fuera por tener alguna copia a la venta —At The Gates a 793 € con
 * dos, The Damned a 440 € con una—. No sale ninguno de los que ya estaban.
 */
export const UMBRAL_RAREZA = 80;

export function esRaro(precio: number, copias: unknown): boolean {
  return puntuacionRareza(precio, copias) >= UMBRAL_RAREZA;
}

/**
 * Cómo se lee la rareza de un disco: "2 copias · 793 €" en lugar de
 * "Score: 317.2", que no le dice nada a nadie.
 */
export function explicarRareza(precio: number, copias: unknown): string {
  const n = Math.max(0, Number(copias) || 0);
  const cuantas = n === 0 ? "Nadie lo vende" : n === 1 ? "1 copia" : `${n} copias`;
  const euros = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(precio) || 0);
  return `${cuantas} · ${euros}`;
}
