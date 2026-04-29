"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./dashboard.module.css";
import { IconVinyl } from "@/components/icons";
import Link from "next/link";

export default function RandomView({ records, latestPrices }: any) {
  const [spinning, setSpinning] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Seleccionamos una muestra de discos para la animación (para no saturar el DOM)
  const sampleRecords = useMemo(() => {
    // Escogemos menos para móviles para evitar crash de rendimiento
    const limit = (typeof window !== 'undefined' && window.innerWidth < 800) ? 15 : 40;
    return [...records].sort((a: any, b: any) => 0.5 - Math.random()).slice(0, limit);
  }, [records]);

  const spin = () => {
    if (sampleRecords.length === 0) return;
    setSpinning(true);
    const targetIndex = Math.floor(Math.random() * sampleRecords.length);
    
    // Animación de scroll
    let current = 0;
    const duration = 3000; // 3 segundos de spin
    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentIndex = Math.floor(easeOut * (targetIndex + sampleRecords.length * 2)) % sampleRecords.length;
      
      setSelectedIndex(currentIndex);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setSelectedIndex(targetIndex);
      }
    };

    requestAnimationFrame(animate);
  };

  useEffect(() => {
    spin();
  }, []);

  return (
    <div className={styles.randomContainer}>
      <div className={styles.galleryWrapper}>
        <div className={styles.galleryStage}>
          {sampleRecords.map((record, index) => {
            const distance = Math.abs(index - selectedIndex);
            const isActive = index === selectedIndex;
            
            // Estilos dinámicos para el efecto Coverflow
            const style = {
              transform: `
                translate(-50%, -50%)
                translateX(${(index - selectedIndex) * 80}px) 
                rotateY(${(index - selectedIndex) * -35}deg) 
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
                  <img src={record.cover_image} alt="" className={styles.galleryImg} />
                ) : (
                  <div className={styles.galleryPlaceholder}>
                    <IconVinyl className={styles.galleryPlaceholderIcon} />
                  </div>
                )}
              </div>
            );

            if (isActive && !spinning) {
              return (
                <Link key={record.id} href={`/release/${record.discogs_release_id}`}>
                  {itemContent}
                </Link>
              );
            }

            return <div key={record.id}>{itemContent}</div>;
          })}
        </div>
      </div>

      <div className={styles.randomInfoBox}>
        {!spinning ? (
          <div className={styles.revealInfo}>
            <div className={styles.revealArtist}>{sampleRecords[selectedIndex]?.artist}</div>
            <div className={styles.revealTitle}>{sampleRecords[selectedIndex]?.title}</div>
          </div>
        ) : (
          <div className={styles.revealInfo} style={{ opacity: 0 }}>
             <div className={styles.revealArtist}>-</div>
             <div className={styles.revealTitle}>-</div>
          </div>
        )}
        <button 
          onClick={spin} 
          className={styles.spinAgainBtn}
          disabled={spinning}
        >
          {spinning ? "Escogiendo..." : "¡Probar de nuevo!"}
        </button>
      </div>
    </div>
  );
}
