"use client";

import Link from "next/link";

import { useMemo } from "react";
import styles from "./dashboard.module.css";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend 
} from "recharts";
import StyleChart from "./genre-chart";
import { IconStar, IconEuro, IconArrowUp, IconArrowDown, IconMinus } from "@/components/icons";

export default function AnalyticsView({ latestPrices, records, enriched }: any) {
  
  const formatEuro = (val: number) => 
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

  // 📈 DATA: Últimas Variaciones (solo los que han cambiado)
  const latestChanges = useMemo(() => {
    return (enriched || [])
      .filter((item: any) => item.trend !== "stable")
      .sort((a: any, b: any) => {
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
    return bins.map((bin: any) => ({
      ...bin,
      count: latestPrices.filter((p: any) => {
        const price = p.median_price || p.lowest_price || 0;
        return price >= bin.min && price < bin.max;
      }).length
    }));
  }, [latestPrices]);

  // 🥧 DATA: Peso por Estilo en Valor Total
  const styleValueData = useMemo(() => {
    const values: Record<string, number> = {};
    latestPrices.forEach((p: any) => {
      const record = records.find((r: any) => r.discogs_release_id === p.release_id);
      const style = record?.style?.split(",")[0] || "Otros";
      const price = p.median_price || p.lowest_price || 0;
      values[style] = (values[style] || 0) + price;
    });
    return Object.entries(values)
      .map(([name, value]: [string, number]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 7);
  }, [latestPrices, records]);

  // 🧭 DATA: Scatter Plot (Precio vs Escasez/Stock)
  const scatterData = useMemo(() => {
    return latestPrices.map((p: any) => {
      const record = records.find((r: any) => r.discogs_release_id === p.release_id);
      return {
        x: p.num_for_sale || 0,
        y: p.median_price || p.lowest_price || 0,
        name: record?.title || "Disco",
        artist: record?.artist || ""
      };
    }).filter((d: any) => d.y > 0);
  }, [latestPrices, records]);

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
                {styleValueData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatEuro(Number(value))} />
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
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }: any) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
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
            {[...latestPrices].sort((a: any, b: any) => (b.median_price || b.lowest_price) - (a.median_price || a.lowest_price)).slice(0, 5).map((p: any, i: number) => {
              const r = records.find((rec: any) => rec.discogs_release_id === p.release_id);
              return (
                <Link href={`/release/${p.release_id}`} key={p.id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}>{i+1}</span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>{formatEuro(p.median_price || p.lowest_price)}</div>
                  </div>
                </Link>
              );
            })}
         </div>

         <div className={styles.rankingColumn}>
            <h3 className={styles.analyticTitle}><IconStar className={styles.titleIcon} /> Índice de Rareza</h3>
            {latestPrices.map((p: any) => {
              const price = p.median_price || p.lowest_price || 0;
              const stock = p.num_for_sale || 1;
              return { ...p, rareScore: price / (stock + 0.5) };
            }).sort((a: any, b: any) => b.rareScore - a.rareScore).slice(0, 5).map((p: any, i: number) => {
              const r = records.find((rec: any) => rec.discogs_release_id === p.release_id);
              return (
                <Link href={`/release/${p.release_id}`} key={p.id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}><IconStar className={styles.rankStar} /></span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>Score: {p.rareScore.toFixed(1)}</div>
                  </div>
                </Link>
              );
            })}
         </div>
      </div>

      <div className={styles.chartCardFull} style={{ marginTop: '32px' }}>
        <h3 className={styles.analyticTitle}><IconArrowUp className={styles.titleIcon} style={{ color: '#1ED760' }} /> Todas las Variaciones Recientes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {latestChanges.length > 0 ? latestChanges.map((item: any) => (
            <Link href={`/release/${item.release_id}`} key={item.id} className={styles.rankingItem} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 12px' }}>
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
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '14px', gridColumn: '1 / -1' }}>
              No se han detectado variaciones en la última sincronización
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
