"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./dashboard.module.css";
import { IconVinyl } from "@/components/icons";
import Link from "next/link";

interface DiscoAleatorio {
  id: string | number;
  discogs_release_id: string | number;
  artist?: string | null;
  title?: string | null;
  cover_image?: string | null;
}

interface Tirada {
  limite: number;
  muestra: DiscoAleatorio[];
  /** Posición del ganador dentro de la muestra. */
  ganador: number;
  /** Posición que se está pintando ahora (va cambiando durante el giro). */
  seleccion: number;
}

/** Barajado de Fisher-Yates. `sort(() => 0.5 - Math.random())` no reparte igual. */
function mezclar<T>(origen: T[]): T[] {
  const a = [...origen];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Elige el ganador entre TODOS los discos y luego le busca acompañantes para la
 * animación.
 *
 * Antes se cogía una muestra de 40 al abrir la pestaña y se sorteaba siempre
 * dentro de ella: los otros 1.290 discos no podían salir por mucho que le dieras
 * a «probar de nuevo».
 */
function elegirTirada(todos: DiscoAleatorio[], limite: number): Tirada {
  if (!todos || todos.length === 0) {
    return { limite, muestra: [], ganador: 0, seleccion: 0 };
  }
  const ganador = todos[Math.floor(Math.random() * todos.length)];
  const acompanantes = mezclar(todos.filter((r) => r !== ganador)).slice(0, Math.max(0, limite - 1));
  const muestra = mezclar([ganador, ...acompanantes]);
  const pos = muestra.indexOf(ganador);
  return { limite, muestra, ganador: pos, seleccion: pos };
}

/** El coverflow con muchas portadas se atraganta en móvil. */
function limitePorPantalla(): number {
  return typeof window !== "undefined" && window.innerWidth < 800 ? 15 : 40;
}

export default function RandomView({ records }: { records: DiscoAleatorio[] }) {
  // Inicializador perezoso en lugar de un efecto: esta vista solo se monta en
  // cliente (la pestaña por defecto es Colección), así que no hay riesgo de que
  // el servidor y el navegador pinten discos distintos.
  //
  // Al entrar ya se ve un disco, pero sin animación: antes giraba tres segundos
  // cada vez que abrías la pestaña.
  const [tirada, setTirada] = useState<Tirada>(() => elegirTirada(records, limitePorPantalla()));
  const [spinning, setSpinning] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const spin = useCallback(() => {
    if (!records || records.length === 0) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    // Muestra nueva en cada tirada: cualquier disco de la colección puede salir.
    const nueva = elegirTirada(records, limitePorPantalla());

    const prefiereQuieto =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefiereQuieto || nueva.muestra.length === 0) {
      setTirada(nueva);
      setSpinning(false);
      return;
    }

    setTirada(nueva);
    setSpinning(true);

    const duracion = 3000;
    const inicio = Date.now();
    const total = nueva.muestra.length;

    const animate = () => {
      const progreso = Math.min((Date.now() - inicio) / duracion, 1);
      const easeOut = 1 - Math.pow(1 - progreso, 3);
      const idx = Math.floor(easeOut * (nueva.ganador + total * 2)) % total;

      setTirada((t) => (t.seleccion === idx ? t : { ...t, seleccion: idx }));

      if (progreso < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
        setTirada((t) => ({ ...t, seleccion: nueva.ganador }));
        setSpinning(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [records]);

  const { muestra, seleccion } = tirada;
  const elegido = muestra[seleccion];

  return (
    <div className={styles.randomContainer}>
      <div className={styles.galleryWrapper}>
        <div className={styles.galleryStage}>
          {muestra.map((record, index) => {
            const distance = Math.abs(index - seleccion);
            const isActive = index === seleccion;

            const style = {
              transform: `
                translate(-50%, -50%)
                translateX(${(index - seleccion) * 80}px)
                rotateY(${(index - seleccion) * -35}deg)
                translateZ(${isActive ? 200 : -150}px)
                scale(${isActive ? 1.3 : 0.6})
              `,
              opacity: distance > 6 ? 0 : 1 - distance * 0.15,
              zIndex: 100 - distance,
              left: "50%",
              top: "50%",
            };

            const itemContent = (
              <div
                className={`${styles.galleryItem} ${isActive ? styles.activeItem : ""}`}
                style={style}
              >
                {record.cover_image ? (
                  <img src={record.cover_image} alt="" className={styles.galleryImg} loading="lazy" />
                ) : (
                  <div className={styles.galleryPlaceholder}>
                    <IconVinyl className={styles.galleryPlaceholderIcon} />
                  </div>
                )}
              </div>
            );

            if (isActive && !spinning) {
              return (
                <Link
                  key={record.id}
                  href={`/release/${record.discogs_release_id}`}
                  aria-label={`Ver ${record.artist ?? ""} – ${record.title ?? ""}`}
                >
                  {itemContent}
                </Link>
              );
            }

            return <div key={record.id}>{itemContent}</div>;
          })}
        </div>
      </div>

      <div className={styles.randomInfoBox}>
        <div
          className={styles.revealInfo}
          style={{ opacity: spinning ? 0 : 1 }}
          aria-live="polite"
        >
          <div className={styles.revealArtist}>{elegido?.artist ?? "-"}</div>
          <div className={styles.revealTitle}>{elegido?.title ?? "-"}</div>
        </div>
        <button
          onClick={spin}
          className={styles.spinAgainBtn}
          disabled={spinning || !records?.length}
        >
          {spinning ? "Escogiendo..." : "¡Probar de nuevo!"}
        </button>
      </div>
    </div>
  );
}
