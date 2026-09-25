"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import styles from "@/app/dashboard.module.css";
import { separarTokens } from "@/lib/collection";
import { eurosRedondeados } from "@/lib/formato";
import type { DiscoConPrecio } from "@/lib/types";

/**
 * Los estilos de la colección: cuántos discos y cuánto valen.
 *
 * Antes eran dos gráficos. Uno contaba discos sobre `records` y el otro
 * repartía euros sobre los que tienen precio, así que no hablaban del mismo
 * conjunto; y el de euros era un donut, que da a entender un reparto del
 * total. No lo es: un disco con tres estilos suma en los tres, y las
 * porciones sumaban más del 100 %. Barras no prometen eso.
 *
 * Los dos contaban además solo el primer estilo de cada disco. 890 de los
 * 1.330 tienen más de uno, así que la barra de "Punk" decía 224 y el filtro
 * de Punk devolvía 442. Ahora cuenta igual que el filtro, que es lo que se
 * abre al pinchar.
 */

const TOP = 12;

export interface FilaEstilo {
  name: string;
  discos: number;
  valor: number;
}

const Tooltipcito = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: FilaEstilo }>;
}) => {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className={styles.chartTooltip}>
      <p className={styles.chartTooltipTitle}>{f.name}</p>
      <p className={styles.chartTooltipValue}>
        {f.discos} {f.discos === 1 ? "disco" : "discos"} · {eurosRedondeados(f.valor)}
      </p>
      <p className={styles.chartTooltipHint}>Pincha para verlos en la Colección</p>
    </div>
  );
};

export default function StyleChart({
  enriched,
  onSelect,
}: {
  enriched: DiscoConPrecio[];
  /** Abre la Colección filtrada por ese estilo. */
  onSelect: (estilo: string) => void;
}) {
  const { filas, conVarios } = useMemo(() => {
    const discos: Record<string, number> = {};
    const valor: Record<string, number> = {};
    let conVarios = 0;

    for (const item of enriched) {
      const tokens = separarTokens(item.record?.style);
      if (tokens.length > 1) conVarios++;
      for (const t of tokens.length ? tokens : ["Sin estilo"]) {
        discos[t] = (discos[t] || 0) + 1;
        valor[t] = (valor[t] || 0) + item.price;
      }
    }

    const filas = Object.entries(discos)
      .map(([name, n]) => ({ name, discos: n, valor: valor[name] }))
      .sort((a, b) => b.discos - a.discos)
      .slice(0, TOP);

    return { filas, conVarios };
  }, [enriched]);

  return (
    <>
      <h3 className={styles.analyticTitle}>Estilos de la colección</h3>
      <ResponsiveContainer width="100%" height={40 + filas.length * 28}>
        <BarChart layout="vertical" data={filas} margin={{ left: 8, right: 76, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            stroke="var(--texto-secundario)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip cursor={{ fill: "var(--superficie-alta)" }} content={<Tooltipcito />} />
          <Bar
            dataKey="discos"
            radius={[0, 4, 4, 0]}
            onClick={(fila: unknown) => onSelect((fila as FilaEstilo).name)}
            className={styles.barraPinchable}
          >
            {/* Un solo color: el degradado anterior terminaba en un verde casi
                negro que no se distinguía del fondo en las últimas barras. */}
            {filas.map((f) => (
              <Cell key={f.name} fill="var(--acento)" fillOpacity={0.45 + 0.55 * (f.discos / filas[0].discos)} />
            ))}
            <LabelList
              dataKey="valor"
              position="right"
              formatter={(v: unknown) => eurosRedondeados(Number(v))}
              fill="var(--texto-secundario)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className={styles.chartNota}>
        Barra: número de discos. A la derecha, lo que valen. {conVarios} de {enriched.length} discos
        tienen más de un estilo y cuentan en cada uno, así que la suma pasa del total.
      </p>
    </>
  );
}
