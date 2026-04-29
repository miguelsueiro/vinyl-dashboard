"use client";

import styles from "./loader.module.css";

export default function LoadingVinyl() {
  return (
    <div className={styles.loaderOverlay}>
      <div className={styles.vinylContainer}>
        <svg viewBox="0 0 100 100" className={styles.vinylSvg}>
          {/* Outer Record */}
          <circle cx="50" cy="50" r="45" fill="#111" stroke="#333" strokeWidth="0.5" />
          {/* Grooves */}
          <circle cx="50" cy="50" r="35" fill="none" stroke="#222" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#222" strokeWidth="0.5" />
          {/* Label */}
          <circle cx="50" cy="50" r="15" fill="#1ED760" />
          {/* Center Hole */}
          <circle cx="50" cy="50" r="2" fill="#090909" />
        </svg>
      </div>
      <p className={styles.loadingText}>Sincronizando colección...</p>
    </div>
  );
}
