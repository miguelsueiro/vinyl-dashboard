"use client";

import Link from "next/link";
import styles from "@/app/dashboard.module.css";
import { IconVinyl, IconArrowUp, IconArrowDown, IconMinus } from "@/components/icons";
import { variacion, formatearDelta } from "@/lib/collection";
import type { DiscoConPrecio } from "@/lib/types";

/**
 * La tarjeta de un disco en una cuadrícula.
 *
 * Estaba escrita dos veces, en la portada y en las carpetas, y las copias ya
 * habían divergido: la de carpetas nunca llegó a tener el punto de fiabilidad
 * ni el resumen de la variación en el tooltip. Se corrigió una y no la otra.
 *
 * El destino lo decide quien la usa: la portada arrastra sus filtros en la URL
 * y las carpetas solo la sección, para que "Volver" funcione en cada caso.
 */

const formatEuro = (val: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);

/** "firme" -> "confFirme", que es como se llaman las clases del semáforo. */
function claseNivel(nivel: string): string {
  return `conf${nivel.charAt(0).toUpperCase()}${nivel.slice(1)}`;
}

function claseTendencia(tendencia: string): string {
  return `trend${tendencia.charAt(0).toUpperCase()}${tendencia.slice(1)}`;
}

export default function RecordCard({ item, href }: { item: DiscoConPrecio; href: string }) {
  const v = variacion(item.price, item.prevPrice);

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.coverWrapper}>
        {item.record?.cover_image ? (
          <img
            src={item.record.cover_image}
            alt=""
            className={styles.coverImg}
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
          />
        ) : (
          <IconVinyl className={styles.coverPlaceholderIcon} />
        )}
      </div>

      <div className={styles.cardInfo}>
        <div className={styles.recordArtist}>{item.record?.artist}</div>
        <div className={styles.recordTitle}>{item.record?.title}</div>

        <div className={styles.recordPrice}>
          <span className={styles.priceWithDot}>
            <i
              className={`${styles.confDot} ${styles[claseNivel(item.confidence.nivel)]}`}
              title={`${item.confidence.etiqueta} — ${item.confidence.motivo}`}
              aria-label={`Fiabilidad: ${item.confidence.etiqueta}. ${item.confidence.motivo}`}
            />
            {formatEuro(item.price)}
          </span>

          {/* La variación, no el precio anterior: una flecha verde junto a
              "33,63 €" se lee como si eso fuera lo que ha subido. */}
          <div
            className={`${styles.trendIndicator} ${styles[claseTendencia(item.trend)]}`}
            title={
              item.trend === "stable"
                ? "Sin cambios desde la última actualización"
                : `Antes ${formatEuro(item.prevPrice)}${v.etiquetaPorcentaje ? ` · ${v.etiquetaPorcentaje}` : ""}`
            }
          >
            {item.trend === "up" && <IconArrowUp className={styles.trendIcon} />}
            {item.trend === "down" && <IconArrowDown className={styles.trendIcon} />}
            {item.trend === "stable" && <IconMinus className={styles.trendIcon} />}
            <span>{item.trend === "stable" ? "igual" : formatearDelta(v.absoluta)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
