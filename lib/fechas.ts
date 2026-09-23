/**
 * Frescura del dato que se enseña.
 *
 * El dashboard no decía en ninguna parte de cuándo eran los precios. En
 * septiembre de 2026 el cron estuvo diecinueve días parado y el único síntoma
 * era que el gráfico dejaba de crecer: había que fijarse mucho para notarlo.
 *
 * Se calcula en el servidor y se pasa ya formateado a la interfaz. Si se
 * calculara en cliente, el "hace X horas" del servidor y el del navegador no
 * coincidirían y React avisaría de un desajuste de hidratación.
 */

/** A partir de aquí la sincronización nocturna se ha saltado al menos una noche. */
export const DIAS_PARA_AVISAR = 2;

export interface Frescura {
  /** Fecha ISO, para el atributo datetime. */
  iso: string;
  /** "hoy a las 10:22", "ayer a las 09:15", "el 3 de septiembre". */
  etiqueta: string;
  dias: number;
  /** true cuando lleva demasiado sin actualizarse. */
  obsoleto: boolean;
}

export function calcularFrescura(fecha: string | Date | null | undefined, ahora = new Date()): Frescura | null {
  if (!fecha) return null;
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return null;

  const hora = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(d);

  // Por días de calendario, no por horas transcurridas: a las 23:00 de ayer y
  // a las 01:00 de hoy las separa poco tiempo pero son "ayer" y "hoy".
  //
  // El día se calcula EN MADRID, igual que la hora que se enseña. Con
  // getDate(), que usa la zona del proceso, en Vercel (UTC) una sincronización
  // de las 22:14 UTC saldría como "ayer a las 00:14": las dos mitades de la
  // misma frase contándolo en zonas distintas.
  const diaEnMadrid = (x: Date) => {
    const [y, m, dd] = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Madrid",
    }).format(x).split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  const dias = Math.round((diaEnMadrid(ahora) - diaEnMadrid(d)) / 86400000);

  let etiqueta: string;
  if (dias <= 0) etiqueta = `hoy a las ${hora}`;
  else if (dias === 1) etiqueta = `ayer a las ${hora}`;
  else if (dias < 7) etiqueta = `hace ${dias} días`;
  else {
    const fechaLarga = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Madrid",
    }).format(d);
    etiqueta = `el ${fechaLarga} — hace ${dias} días`;
  }

  return { iso: d.toISOString(), etiqueta, dias, obsoleto: dias >= DIAS_PARA_AVISAR };
}
