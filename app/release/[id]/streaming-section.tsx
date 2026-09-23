"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./release.module.css";
import { saveStreamingUrl } from "../../actions";
import { IconPlay, IconEdit } from "@/components/icons";

export default function StreamingSection({ id, initialUrl }: { id: string, initialUrl: string | null }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // Se deriva en lugar de copiar la prop a un estado y sincronizarla con un
  // efecto: sin enlace guardado el formulario sale abierto, y si hay enlace
  // solo se abre cuando el usuario pulsa editar. Al guardar, el servidor manda
  // el enlace nuevo y basta con bajar la bandera.
  const [edicionPedida, setEdicionPedida] = useState(false);
  const isEditing = edicionPedida || !initialUrl;
  const setIsEditing = setEdicionPedida;

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
