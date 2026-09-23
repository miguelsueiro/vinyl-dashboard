"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { separarTokens } from "@/lib/collection";
import type { Disco } from "@/lib/types";

// Fuera del componente a propósito: definido dentro, React lo trata como un
// componente nuevo en cada render y desmonta y vuelve a montar el tooltip.
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) => {
  if (active && payload && payload.length) {
    return (
    <div style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 15px", borderRadius: "12px", color: "#fff" }}>
      <p style={{ margin: 0, fontWeight: "bold" }}>{payload[0].payload.name}</p>
      <p style={{ margin: 0, color: "#1ED760" }}>{`${payload[0].value} unidades`}</p>
    </div>
    );
  }
  return null;
};

export default function StyleChart({ records }: { records: Disco[] }) {
  const chartData = useMemo(() => {
    if (!records) return [];
    
    const counts: Record<string, number> = {};
    records.forEach(r => {
      // Tomamos el primer estilo (suelen venir varios)
      const style = separarTokens(r.style)[0] || "Otros";
      counts[style] = (counts[style] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Mostramos top 10 estilos
  }, [records]);

  const COLORS = ["#1ED760", "#1db954", "#1aa34a", "#178d40", "#147736", "#11612c", "#0e4b22", "#0b3518", "#08200f", "#051007"];


  return (
    <div style={{ width: "100%", height: 320, background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
      <h3 style={{ margin: "0 0 16px 0", color: "rgba(255,255,255,0.7)", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Distribución por Estilos (Top 10)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart layout="vertical" data={chartData} margin={{ left: 20, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="rgba(255,255,255,0.6)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            width={100}
          />
          <Tooltip 
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={<CustomTooltip />}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
