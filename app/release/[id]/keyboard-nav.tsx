"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mover de disco con las flechas del teclado.
 *
 * La ficha es un Server Component, así que esto va aparte: solo escucha
 * teclado y navega. No pinta nada.
 */
export default function KeyboardNav({
  prevUrl,
  nextUrl,
}: {
  prevUrl: string | null;
  nextUrl: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      // Con una tecla modificadora, el atajo es del navegador (atrás/adelante).
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      // Si se está escribiendo o dentro de un control, las flechas mueven el
      // cursor: sería muy molesto saltar de disco a media frase.
      const activo = document.activeElement as HTMLElement | null;
      if (activo) {
        const etiqueta = activo.tagName;
        if (
          etiqueta === "INPUT" ||
          etiqueta === "TEXTAREA" ||
          etiqueta === "SELECT" ||
          activo.isContentEditable
        ) {
          return;
        }
      }

      const destino = e.key === "ArrowLeft" ? prevUrl : nextUrl;
      if (!destino) return;

      e.preventDefault();
      router.push(destino);
    };

    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [prevUrl, nextUrl, router]);

  return null;
}
