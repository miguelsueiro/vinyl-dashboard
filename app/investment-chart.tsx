"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function InvestmentChart({ snapshots }: { snapshots: any[] }) {
  const [range, setRange] = useState<"1M" | "1Y" | "ALL" | "CUSTOM">("1M");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    let filtered = [...snapshots];
    const now = new Date();

    if (range === "1M") {
      const cutoff = new Date();
      cutoff.setMonth(now.getMonth() - 1);
      filtered = snapshots.filter(s => new Date(s.created_at) >= cutoff);
    } else if (range === "1Y") {
      const cutoff = new Date();
      cutoff.setFullYear(now.getFullYear() - 1);
      filtered = snapshots.filter(s => new Date(s.created_at) >= cutoff);
    } else if (range === "CUSTOM" && customStart) {
      const start = new Date(customStart);
      const end = customEnd ? new Date(customEnd) : new Date();
      filtered = snapshots.filter(s => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      });
    }

    // AGRUPACIÓN SEGÚN EL RANGO
    const grouped = new Map();
    filtered.forEach(s => {
      const d = new Date(s.created_at);
      let key = "";
      if (range === "1M" || (range === "CUSTOM" && filtered.length < 60)) {
        key = d.toISOString().split('T')[0]; // Por día
      } else if (range === "1Y" || (range === "CUSTOM" && filtered.length < 730)) {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // Por mes
      } else {
        key = `${d.getFullYear()}`; // Por año
      }
      grouped.set(key, s); // Guardamos el último valor de ese periodo
    });

    return Array.from(grouped.values()).map(s => ({
      date: new Date(s.created_at).toLocaleDateString("es-ES", { 
        day: (range === "1M" || range === "CUSTOM") ? '2-digit' : undefined,
        month: 'short',
        year: range === "ALL" ? 'numeric' : undefined
      }),
      fullDate: new Date(s.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'long', year: 'numeric' }),
      value: Number(s.total_value.toFixed(2)),
    }));
  }, [snapshots, range, customStart, customEnd]);

  const currencyFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (chartData.length === 0 && snapshots.length > 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 28, color: 'rgba(255,255,255,0.4)' }}>
        No hay datos para este periodo.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: 400, background: "rgba(255,255,255,0.02)", borderRadius: 28, padding: "28px 32px", marginBottom: 48, border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <h3 style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Evolución de la Colección
        </h3>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {range === "CUSTOM" && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 12 }}>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', color: '#fff', fontSize: 11 }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>-</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', color: '#fff', fontSize: 11 }} />
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12 }}>
            {(["1M", "1Y", "ALL", "CUSTOM"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: range === r ? '#fff' : 'transparent',
                  color: range === r ? '#000' : 'rgba(255,255,255,0.5)',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {r === "1M" ? "MES" : r === "1Y" ? "AÑO" : r === "ALL" ? "TOTAL" : "FILTRO"}
              </button>
            ))}
          </div>
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
