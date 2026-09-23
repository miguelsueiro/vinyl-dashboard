import styles from "./release.module.css";

/**
 * Esqueleto de la ficha de disco.
 *
 * Antes cualquier navegación caía en el loader de pantalla completa de
 * app/loading.tsx: el vinilo girando y una cita, tapando toda la página cada
 * vez que se abría un disco.
 *
 * Tener este fichero hace además que Next pueda PRE-CARGAR parcialmente la
 * ruta: sin un loading.tsx, el prefetch de una ruta dinámica se salta.
 */
export default function CargandoFicha() {
  return (
    <div className={styles.releaseRoot} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Cargando el disco…</span>

      <div className={styles.navRow}>
        <div className={`${styles.skel} ${styles.skelBack}`} />
        <div className={styles.quickNav}>
          <div className={`${styles.skel} ${styles.skelNavBtn}`} />
          <div className={`${styles.skel} ${styles.skelPos}`} />
          <div className={`${styles.skel} ${styles.skelNavBtn}`} />
        </div>
      </div>

      <div className={styles.topSection}>
        <div className={styles.coverBox}>
          <div className={`${styles.skel} ${styles.skelCover}`} />
        </div>

        <div className={styles.infoBox}>
          <div className={`${styles.skel} ${styles.skelArtist}`} />
          <div className={`${styles.skel} ${styles.skelTitle}`} />
          <div className={styles.skelTags}>
            <div className={`${styles.skel} ${styles.skelTag}`} />
            <div className={`${styles.skel} ${styles.skelTag}`} />
            <div className={`${styles.skel} ${styles.skelTag}`} />
          </div>
          <div className={`${styles.skel} ${styles.skelPrice}`} />
          <div className={`${styles.skel} ${styles.skelLine}`} />
        </div>
      </div>
    </div>
  );
}
