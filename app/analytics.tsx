"use client";

import Link from "next/link";

import { useMemo } from "react";
import styles from "./dashboard.module.css";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend 
} from "recharts";
import StyleChart from "./genre-chart";
import { IconStar, IconEuro, IconArrowUp, IconArrowDown } from "@/components/icons";
import { separarTokens } from "@/lib/collection";
import type { Disco, DiscoConPrecio, DiscoConRareza } from "@/lib/types";

// `enriched` llega desde la portada con el disco y el precio ya cruzados. Antes
// esta vista recibía además latestPrices y records sueltos y los volvía a cruzar
// con records.find() dentro de un map: 1.331 × 1.331 comparaciones, tres veces.
export default function AnalyticsView({ records, enriched }: { records: Disco[]; enriched: DiscoConPrecio[] }) {

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

  const histogramData = useMemo(() => {
    const bins = [
      { name: "0-20€", min: 0, max: 20 },
      { name: "20-50€", min: 20, max: 50 },
      { name: "50-100€", min: 50, max: 100 },
      { name: "100-200€", min: 100, max: 200 },
      { name: "200€+", min: 200, max: 999999 },
    ];
    return bins.map((bin) => ({
      ...bin,
      count: enriched.filter((item) => item.price >= bin.min && item.price < bin.max).length
    }));
  }, [enriched]);

  // 🥧 DATA: Peso por Estilo en Valor Total
  const styleValueData = useMemo(() => {
    const values: Record<string, number> = {};
    enriched.forEach((item) => {
      const style = separarTokens(item.record?.style)[0] || "Otros";
      values[style] = (values[style] || 0) + item.price;
    });
    return Object.entries(values)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [enriched]);

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

  // Caro y con poca oferta = raro. El +0.5 evita dividir por cero cuando no hay
  // ninguna copia a la venta, que es justo el caso más escaso.
  const topRare = useMemo(
    (): DiscoConRareza[] => enriched
      .map((item) => ({ ...item, rareScore: item.price / ((Number(item.num_for_sale) || 0) + 0.5) }))
      .sort((a, b) => b.rareScore - a.rareScore)
      .slice(0, 5),
    [enriched]
  );

  const COLORS = ["#1ED760", "#2ECC71", "#3498DB", "#9B59B6", "#E67E22", "#E74C3C", "#F1C40F"];

  return (
    <div className={styles.analyticsContainer}>
      <div className={styles.chartCardFull}>
        <StyleChart records={records} />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCardFull}>
          <h3 className={styles.analyticTitle}>Distribución por Rango de Precios</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogramData}>
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
              <Bar dataKey="count" fill="#1ED760" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.analyticTitle}>Peso de Estilos (€ Total)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={styleValueData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                {styleValueData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatEuro(Number(value))} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
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
                <Link href={`/release/${item.release_id}`} key={item.release_id} className={styles.rankingItem}>
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
                <Link href={`/release/${item.release_id}`} key={item.release_id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}><IconStar className={styles.rankStar} /></span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>Score: {item.rareScore.toFixed(1)}</div>
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
            <Link href={`/release/${item.release_id}`} key={item.release_id} className={styles.rankingItem} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 12px' }}>
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
