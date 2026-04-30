"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function InvestmentChart({ snapshots }: { snapshots: any[] }) {
  const [range, setRange] = useState<"1M" | "1Y" | "ALL">("ALL");

  const filteredSnapshots = useMemo(() => {
    if (!snapshots) return [];
    
    // 1. Agrupar por día (solo el último snapshot de cada día)
    const dailyMap = new Map();
    snapshots.forEach(s => {
      const dateKey = new Date(s.created_at).toISOString().split('T')[0];
      dailyMap.set(dateKey, s);
    });
    const uniqueDays = Array.from(dailyMap.values());

    if (range === "ALL") return uniqueDays;

    const now = new Date();
    const cutoff = new Date();
    if (range === "1M") cutoff.setMonth(now.getMonth() - 1);
    if (range === "1Y") cutoff.setFullYear(now.getFullYear() - 1);

    return uniqueDays.filter(s => new Date(s.created_at) >= cutoff);
  }, [snapshots, range]);

  const chartData = useMemo(() => {
    return filteredSnapshots.map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("es-ES", { 
        day: '2-digit',
        month: 'short'
      }),
      fullDate: new Date(s.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'long', year: 'numeric' }),
      value: Number(s.total_value.toFixed(2)),
    }));
  }, [filteredSnapshots]);

  const currencyFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (chartData.length === 0 && snapshots.length > 0) {
    // Show a message if no data in range
    return (
      <div style={{ padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
        No hay datos para este periodo.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 340, background: "rgba(255,255,255,0.02)", borderRadius: 28, padding: "28px 32px", marginBottom: 48, border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h3 style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Evolución de la Colección
        </h3>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', padding: 6, borderRadius: 14 }}>
          {(["1M", "1Y", "ALL"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: range === r ? '#fff' : 'transparent',
                color: range === r ? '#000' : 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {r === "1M" ? "MES" : r === "1Y" ? "AÑO" : "TOTAL"}
            </button>
          ))}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1ED760" stopOpacity={0.5}/>
              <stop offset="95%" stopColor="#1ED760" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={10} 
            fontWeight={600}
            tickLine={false} 
            axisLine={false} 
            dy={15}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={10} 
            fontWeight={600}
            tickFormatter={(val) => `${Math.round(val).toLocaleString('es-ES')}€`}
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip 
            labelFormatter={(label, entries) => entries[0]?.payload?.fullDate}
            formatter={(value: any) => [currencyFormatter.format(value), "Valor Total"]}
            contentStyle={{ borderRadius: 20, background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#1ED760" 
            strokeWidth={4} 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            animationDuration={1200}
            activeDot={{ r: 6, stroke: '#1ED760', strokeWidth: 2, fill: '#000' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
