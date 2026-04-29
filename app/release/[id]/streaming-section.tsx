"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./release.module.css";
import { saveStreamingUrl } from "../../actions";
import { IconPlay, IconEdit, IconVinyl } from "@/components/icons";

export default function StreamingSection({ id, initialUrl }: { id: string, initialUrl: string | null }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!initialUrl);
  const [isPending, setIsPending] = useState(false);

  // Sincronizar el estado de edición si la prop cambia desde el servidor
  useEffect(() => {
    setIsEditing(!initialUrl);
  }, [initialUrl]);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    const result = await saveStreamingUrl(formData);
    
    if (result?.success) {
      router.refresh(); // Forzamos a Next.js a pedir los datos de nuevo
      setIsEditing(false);
    } else {
      alert("Error al guardar: " + (result?.error || "Desconocido"));
    }
    setIsPending(false);
  }

  return (
    <div className={styles.streamingBox}>
      {initialUrl && !isEditing ? (
        <div className={styles.activeStreamRow}>
          <a href={initialUrl} target="_blank" rel="noopener noreferrer" className={styles.playLink}>
            <IconPlay className={styles.btnIcon} style={{ width: 14, height: 14 }} /> Escuchar en streaming
          </a>
          <button 
            onClick={() => setIsEditing(true)} 
            className={styles.editToggleBtn}
            title="Editar enlace"
            disabled={isPending}
          >
            <IconEdit className={styles.btnIcon} style={{ width: 14, height: 14, marginRight: 0 }} />
          </button>
        </div>
      ) : (
        <div className={styles.editContainer}>
          <form action={handleSubmit} className={styles.streamForm}>
            <input type="hidden" name="releaseId" value={id} />
            <input 
              type="url" 
              name="url" 
              defaultValue={initialUrl || ""}
              placeholder="Pega el enlace de Tidal o Spotify" 
              required 
              className={styles.streamInput} 
              disabled={isPending}
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.saveBtn} disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar enlace"}
              </button>
              {initialUrl && (
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className={styles.cancelBtn}
                  disabled={isPending}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
