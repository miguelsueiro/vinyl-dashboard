/**
 * Cómo se escriben los euros.
 *
 * Estaba resuelto en ocho sitios con tres comportamientos distintos, y la
 * diferencia no era una decisión: unos pasaban maximumFractionDigits y otros
 * no, así que el mismo importe salía con céntimos o sin ellos según la
 * pantalla. Aquí son dos funciones con nombre, y elegir una es una decisión.
 */

const CON_CENTIMOS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SIN_CENTIMOS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Para el precio de un disco concreto, donde los céntimos son el dato. */
export const euros = (valor: number) => CON_CENTIMOS.format(valor);

/** Para sumas y totales, donde los céntimos son ruido. */
export const eurosRedondeados = (valor: number) => SIN_CENTIMOS.format(valor);
