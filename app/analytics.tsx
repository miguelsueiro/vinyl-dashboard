"use client";

import Link from "next/link";

import { useMemo } from "react";
import styles from "./dashboard.module.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from "recharts";
import StyleChart from "@/components/StyleChart";
import { IconStar, IconEuro, IconArrowUp, IconArrowDown } from "@/components/icons";
import type { FiltrosColeccion } from "@/lib/collection";
import type { DiscoConPrecio, DiscoConRareza } from "@/lib/types";
import { puntuacionRareza, explicarRareza } from "@/lib/rareza";

// `enriched` llega desde la portada con el disco y el precio ya cruzados. Antes
// esta vista recibía además latestPrices y records sueltos y los volvía a cruzar
// con records.find() dentro de un map: 1.331 × 1.331 comparaciones, tres veces.
export default function AnalyticsView({ enriched, urlDisco, verEnColeccion }: {
  enriched: DiscoConPrecio[];
  /** La construye la portada para que al volver se conserve la sección. */
  urlDisco: (releaseId: string | number) => string;
  /** Abre la Colección con esos filtros puestos. Los gráficos eran callejones
      sin salida: enseñaban un dato y no había forma de ver qué discos eran. */
  verEnColeccion: (filtros: Partial<FiltrosColeccion>) => void;
}) {

  const formatEuro = (val: number) => 
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

  // 📈 DATA: Últimas Variaciones (solo los que han cambiado)
  const latestChanges = useMemo(() => {
    return (enriched || [])
      .filter((item) => item.trend !== "stable")
      .sort((a, b) => {
        return Math.abs(b.price - b.prevPrice) - Math.abs(a.price - a.prevPrice);
      });
  }, [enriched]);

  const formatEuroPrecise = (val: number) => 
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(val);

  // Los tramos son medio abiertos: un disco de 100 € está en "100-200€" y no
  // en "50-100€". El filtro, en cambio, incluye los dos extremos, así que al
  // pinchar se pide hasta un céntimo menos. Si no, la barra decía 179 y la
  // Colección devolvía 180.
  const TRAMOS = [
    { name: "0-20€", min: 0, hasta: 20 },
    { name: "20-50€", min: 20, hasta: 50 },
    { name: "50-100€", min: 50, hasta: 100 },
    { name: "100-200€", min: 100, hasta: 200 },
    { name: "200€+", min: 200, hasta: null },
  ];

  const histogramData = useMemo(() => TRAMOS.map((t) => ({
    ...t,
    count: enriched.filter((item) => item.price >= t.min && (t.hasta === null || item.price < t.hasta)).length,
  })), [enriched]);

  // 🧭 DATA: Scatter Plot (Precio vs Escasez/Stock)
  const scatterData = useMemo(() => {
    return enriched.map((item) => ({
      x: Number(item.num_for_sale) || 0,
      y: item.price,
      name: item.record?.title || "Disco",
      artist: item.record?.artist || ""
    })).filter((d) => d.y > 0);
  }, [enriched]);

  const topValue = useMemo(
    () => [...enriched].sort((a, b) => b.price - a.price).slice(0, 5),
    [enriched]
  );

  // Misma definición que usa la vista "Rarezas" de la colección: ver lib/rareza.ts
  const topRare = useMemo(
    (): DiscoConRareza[] => enriched
      .map((item) => ({ ...item, rareScore: puntuacionRareza(item.price, item.num_for_sale) }))
      .sort((a, b) => b.rareScore - a.rareScore)
      .slice(0, 5),
    [enriched]
  );

  return (
    <div className={styles.analyticsContainer}>
      <div className={styles.chartCardFull}>
        <StyleChart enriched={enriched} onSelect={(estilo) => verEnColeccion({ style: estilo })} />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCardFull}>
          <h3 className={styles.analyticTitle}>Distribución por Rango de Precios</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogramData}>
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
              <Bar
                dataKey="count"
                fill="var(--acento)"
                radius={[6, 6, 0, 0]}
                className={styles.barraPinchable}
                onClick={(bin: unknown) => {
                  const t = bin as { min: number; hasta: number | null };
                  // El último tramo no tiene techo: sin priceMax se lee "desde 200 €".
                  verEnColeccion({
                    priceMin: String(t.min),
                    ...(t.hasta !== null && { priceMax: (t.hasta - 0.01).toFixed(2) }),
                  });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCardFull}>
          <h3 className={styles.analyticTitle}>Relación Precio vs Stock</h3>
          <ResponsiveContainer width="100%" height={300}>
             <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis type="number" dataKey="x" name="En venta" unit=" uds" stroke="rgba(255,255,255,0.4)" />
                <YAxis type="number" dataKey="y" name="Precio" unit=" €" stroke="rgba(255,255,255,0.4)" />
                <ZAxis type="category" dataKey="name" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload as { artist: string; name: string; x: number; y: number };
                    return (
                      <div style={{ background: "#000", padding: "10px 15px", border: "1px solid #333", borderRadius: 8 }}>
                        <div style={{ fontWeight: "bold" }}>{d.artist} - {d.name}</div>
                        <div style={{ color: "#1ED760" }}>{formatEuro(d.y)}</div>
                        <div style={{ fontSize: "11px", color: "#888" }}>{d.x} en venta actualmente</div>
                      </div>
                    );
                }} />
                <Scatter name="Discos" data={scatterData} fill="#1ED760" opacity={0.6} />
             </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.insightsRanking}>
         <div className={styles.rankingColumn}>
            <h3 className={styles.analyticTitle}><IconEuro className={styles.titleIcon} /> Top 5 Valor Individual</h3>
            {topValue.map((item, i) => {
              const r = item.record;
              return (
                <Link href={urlDisco(item.release_id)} key={item.release_id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}>{i+1}</span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>{formatEuro(item.price)}</div>
                  </div>
                </Link>
              );
            })}
         </div>

         <div className={styles.rankingColumn}>
            <h3 className={styles.analyticTitle}><IconStar className={styles.titleIcon} /> Índice de Rareza</h3>
            {topRare.map((item) => {
              const r = item.record;
              return (
                <Link href={urlDisco(item.release_id)} key={item.release_id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}><IconStar className={styles.rankStar} /></span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>{explicarRareza(item.price, item.num_for_sale)}</div>
                  </div>
                </Link>
              );
            })}
         </div>
      </div>

      <div className={styles.chartCardFull} style={{ marginTop: '32px' }}>
        <h3 className={styles.analyticTitle}><IconArrowUp className={styles.titleIcon} style={{ color: '#1ED760' }} /> Todas las Variaciones Recientes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {latestChanges.length > 0 ? latestChanges.map((item) => (
            <Link href={urlDisco(item.release_id)} key={item.release_id} className={styles.rankingItem} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 12px' }}>
              <div className={styles.rankIndex} style={{ width: '40px' }}>
                 {item.trend === "up" ? <IconArrowUp style={{ color: '#1ED760', width: '16px' }} /> : <IconArrowDown style={{ color: '#ff4d4d', width: '16px' }} />}
              </div>
              <div className={styles.rankInfo}>
                <div className={styles.rankName} style={{ fontSize: '14px' }}>{item.record?.artist} - {item.record?.title}</div>
                <div className={styles.rankPrice} style={{ fontSize: '13px' }}>
                  {formatEuroPrecise(item.prevPrice)} → <span style={{ color: item.trend === "up" ? '#1ED760' : '#ff4d4d', fontWeight: 'bold' }}>{formatEuroPrecise(item.price)}</span>
                </div>
              </div>
            </Link>
          )) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: '14px', gridColumn: '1 / -1' }}>
              No se han detectado variaciones en la última sincronización
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
