import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import styles from "./release.module.css";
import StreamingSection from "./streaming-section";
import { IconVinyl } from "@/components/icons";

export default async function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: records }, { data: prices }] = await Promise.all([
    supabase.from("records").select("*").eq("discogs_release_id", id).single(),
    supabase.from("market_prices").select("*").eq("release_id", id).order("created_at", { ascending: false }),
  ]);

  if (!records) {
    return (
      <div className={styles.container}>
        <h2>Disco no encontrado</h2>
        <Link href="/" className={styles.backBtn}>← Volver</Link>
      </div>
    );
  }

  const latestPrice = prices?.[0] || {};
  const discogsLink = `https://www.discogs.com/release/${id}`;
  
  // Format date safely
  const formatDate = (dateString: string) => {
    if (!dateString) return "Fecha desconocida";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(dateString));
  };

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className={styles.releaseRoot}>
      <Link href="/" className={styles.backBtn}><span>←</span> Volver a la Colección</Link>
      
      <div className={styles.topSection}>
        <div className={styles.coverBox}>
          {records.cover_image ? (
            <img src={records.cover_image} alt={records.title} className={styles.coverImage} />
          ) : (
            <div className={styles.coverPlaceholder}>
              <IconVinyl className={styles.placeholderIcon} />
              <span className={styles.placeholderText}>Sin Portada</span>
            </div>
          )}
        </div>

        <div className={styles.infoBox}>
          <header className={styles.header}>
            <div className={styles.artist}>{records.artist || "Unknown Artist"}</div>
            <h1 className={styles.title}>{records.title || `Release #${id}`}</h1>
            <div className={styles.tags}>
              {records.year && <Link href={`/?year=${encodeURIComponent(records.year)}`} className={styles.tag}>{records.year}</Link>}
              {records.label && <Link href={`/?label=${encodeURIComponent(records.label)}`} className={styles.tag}>{records.label}</Link>}
              {records.genre && <Link href={`/?genre=${encodeURIComponent(records.genre)}`} className={styles.tag}>{records.genre}</Link>}
              {records.style && <Link href={`/?style=${encodeURIComponent(records.style)}`} className={styles.tag}>{records.style}</Link>}
              {records.format && <span className={styles.tag}>{records.format}</span>}
            </div>

            {/* STREAMING LINK SECTION */}
            <StreamingSection id={id} initialUrl={records.streaming_url} />

            <div className={styles.conditionsBox}>
              <div className={styles.conditionRow}>
                <span className={styles.condLabel}>Disco:</span> {records.condition_vinyl || "Desconocido"}
              </div>
              <div className={styles.conditionRow}>
                <span className={styles.condLabel}>Funda:</span> {records.condition_sleeve || "Desconocido"}
              </div>
            </div>

            <a href={discogsLink} target="_blank" rel="noreferrer" className={styles.discogsLink}>
              Ver en Discogs ↗
            </a>
          </header>
        </div>
      </div>

      <div className={styles.priceGrid}>
        <div className={styles.priceCard}>
          <div className={styles.priceLabel}>Valor Estimado de Mercado</div>
          <div className={styles.priceValue}>
            {latestPrice.lowest_price ? formatEuro(latestPrice.lowest_price) : "N/A"}
          </div>
        </div>
      </div>

      {prices && prices.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Historial de Mercado</h2>
          <ul className={styles.historyList}>
            {prices.map((p: any) => (
              <li key={p.id} className={styles.historyItem}>
                <span className={styles.historyDate}>{formatDate(p.created_at)}</span>
                <span className={styles.historyPrice}>
                  {formatEuro(p.median_price || p.lowest_price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}