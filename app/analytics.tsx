"use client";

import { useMemo } from "react";
import styles from "./dashboard.module.css";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend 
} from "recharts";
import StyleChart from "./genre-chart";
import { IconStar, IconEuro } from "@/components/icons";

export default function AnalyticsView({ latestPrices, records }: any) {
  
  const formatEuro = (val: number) => 
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

  // 📊 DATA: Histograma de Precios
  const histogramData = useMemo(() => {
    const bins = [
      { name: "0-20€", min: 0, max: 20 },
      { name: "20-50€", min: 20, max: 50 },
      { name: "50-100€", min: 50, max: 100 },
      { name: "100-200€", min: 100, max: 200 },
      { name: "200€+", min: 200, max: 999999 },
    ];
    return bins.map(bin => ({
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
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
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
                {styleValueData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatEuro(value)} />
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
            {[...latestPrices].sort((a,b) => (b.median_price || b.lowest_price) - (a.median_price || a.lowest_price)).slice(0, 5).map((p, i) => {
              const r = records.find((rec: any) => rec.discogs_release_id === p.release_id);
              return (
                <div key={p.id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}>{i+1}</span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>{formatEuro(p.median_price || p.lowest_price)}</div>
                  </div>
                </div>
              );
            })}
         </div>

         <div className={styles.rankingColumn}>
            <h3 className={styles.analyticTitle}><IconStar className={styles.titleIcon} /> Índice de Rareza</h3>
            {latestPrices.map((p: any) => {
              const price = p.median_price || p.lowest_price || 0;
              const stock = p.num_for_sale || 1;
              return { ...p, rareScore: price / (stock + 0.5) };
            }).sort((a,b) => b.rareScore - a.rareScore).slice(0, 5).map((p, i) => {
              const r = records.find((rec: any) => rec.discogs_release_id === p.release_id);
              return (
                <div key={p.id} className={styles.rankingItem}>
                  <span className={styles.rankIndex}><IconStar className={styles.rankStar} /></span>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankName}>{r?.artist} - {r?.title}</div>
                    <div className={styles.rankPrice}>Score: {p.rareScore.toFixed(1)}</div>
                  </div>
                </div>
              );
            })}
         </div>
      </div>
    </div>
  );
}
