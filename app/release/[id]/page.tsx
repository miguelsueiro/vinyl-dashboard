import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import styles from "./release.module.css";
import StreamingSection from "./streaming-section";
import { IconVinyl, IconChevronLeft, IconChevronRight } from "@/components/icons";

export default async function ReleasePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const sp = await searchParams;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Obtener solo los IDs necesarios para la navegación (MUCHO más rápido)
  // Replicamos los filtros pero solo pedimos la columna de ID
  const search = (sp.search as string) || "";
  const genre = (sp.genre as string) || "";
  const styleFilter = (sp.style as string) || "";
  const year = (sp.year as string) || "";
  const labelFilter = (sp.label as string) || "";
  const formatFilter = (sp.format as string) || "all";
  const sortBy = (sp.sort as string) || "priceDesc";
  const viewMode = (sp.view as string) || "all";

  // Obtenemos solo los IDs para navegar sin cargar 1300+ objetos completos
  const { data: navData } = await supabase
    .from("records")
    .select("discogs_release_id, artist, title, year, genre, style, label, format");

  // Aplicamos la misma lógica de filtrado que en la home pero en memoria
  let filteredIds = (navData || []).filter((r: any) => {
    const q = search.toLowerCase();
    const matchSearch = r.artist?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.discogs_release_id.toString().includes(q);
    const matchGenre = !genre || r.genre?.toLowerCase().includes(genre.trim().toLowerCase());
    const matchStyle = !styleFilter || r.style?.toLowerCase().includes(styleFilter.trim().toLowerCase());
    const matchYear = !year || String(r.year) === year.trim();
    const matchLabel = !labelFilter || r.label?.toLowerCase().includes(labelFilter.trim().toLowerCase());
    
    let rawFormat = r.format?.toLowerCase() || "";
    let itemFormatGroup = "Vinilo";
    if (rawFormat.includes("cd")) itemFormatGroup = "CD";
    if (rawFormat.includes("cassette")) itemFormatGroup = "Cassette";
    
    return matchSearch && matchGenre && matchStyle && matchYear && matchLabel && (formatFilter === "all" || itemFormatGroup === formatFilter);
  });

  // Sort rápido para la navegación
  if (sortBy === "artistAsc") filteredIds.sort((a,b) => (a.artist || "").localeCompare(b.artist || ""));
  else if (sortBy === "yearDesc") filteredIds.sort((a,b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

  const navIds = filteredIds.map(f => f.discogs_release_id);
  const currentIndex = navIds.indexOf(parseInt(id, 10));
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = (currentIndex !== -1 && currentIndex < navIds.length - 1) ? navIds[currentIndex + 1] : null;

  // 2. Carga QUIRÚRGICA de los datos del disco actual
  const { data: recordsData } = await supabase
    .from("records")
    .select("*")
    .eq("discogs_release_id", id)
    .single();

  const { data: currentPrices } = await supabase
    .from("market_prices")
    .select("*")
    .eq("release_id", id)
    .order("created_at", { ascending: false });

  const latestPrice = currentPrices?.[0] || {};
  const discogsLink = `https://www.discogs.com/release/${id}`;

  if (!recordsData) {
    return (
      <div className={styles.releaseRoot}>
        <h2>Disco no encontrado</h2>
        <Link href="/" className={styles.backBtn}>← Volver</Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Fecha desconocida";
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateString));
  };

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(val);
  };

  // Helper para mantener los filtros en los links de navegación
  const getNavUrl = (newId: any) => {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([key, value]) => {
      if (value) params.set(key, value.toString());
    });
    return `/release/${newId}${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div className={styles.releaseRoot}>
      <div className={styles.navRow}>
        <Link href={`/${new URLSearchParams(sp as any).toString() ? `?${new URLSearchParams(sp as any).toString()}` : ""}`} className={styles.backBtn}>
          <span>←</span> Volver
        </Link>
        <div className={styles.quickNav}>
          {prevId ? (
            <Link href={getNavUrl(prevId)} className={styles.navBtn} title="Anterior">
              <IconChevronLeft className={styles.navIcon} />
            </Link>
          ) : (
            <div className={`${styles.navBtn} ${styles.disabled}`}><IconChevronLeft className={styles.navIcon} /></div>
          )}
          {nextId ? (
            <Link href={getNavUrl(nextId)} className={styles.navBtn} title="Siguiente">
              <IconChevronRight className={styles.navIcon} />
            </Link>
          ) : (
            <div className={`${styles.navBtn} ${styles.disabled}`}><IconChevronRight className={styles.navIcon} /></div>
          )}
        </div>
      </div>
      
      <div className={styles.topSection}>
        <div className={styles.coverBox}>
          {recordsData.cover_image ? (
            <img src={recordsData.cover_image} alt={recordsData.title} className={styles.coverImage} />
          ) : (
            <div className={styles.coverPlaceholder}>
              <IconVinyl className={styles.placeholderIcon} />
              <span className={styles.placeholderText}>Sin Portada</span>
            </div>
          )}
        </div>

        <div className={styles.infoBox}>
          <header className={styles.header}>
            <div className={styles.artist}>{recordsData.artist || "Unknown Artist"}</div>
            <h1 className={styles.title}>{recordsData.title || `Release #${id}`}</h1>
            <div className={styles.tags}>
              {recordsData.year && <Link href={`/?year=${encodeURIComponent(recordsData.year)}`} className={styles.tag}>{recordsData.year}</Link>}
              {recordsData.label && <Link href={`/?label=${encodeURIComponent(recordsData.label)}`} className={styles.tag}>{recordsData.label}</Link>}
              {recordsData.genre && <Link href={`/?genre=${encodeURIComponent(recordsData.genre)}`} className={styles.tag}>{recordsData.genre}</Link>}
              {recordsData.format && <span className={styles.tag}>{recordsData.format}</span>}
            </div>

            <StreamingSection id={id} initialUrl={recordsData.streaming_url} />

            <div className={styles.conditionsBox}>
              <div className={styles.conditionRow}>
                <span className={styles.condLabel}>Disco:</span> {recordsData.condition_vinyl || "Desconocido"}
              </div>
              <div className={styles.conditionRow}>
                <span className={styles.condLabel}>Funda:</span> {recordsData.condition_sleeve || "Desconocido"}
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
            {formatEuro(latestPrice.median_price || latestPrice.lowest_price || 0)}
          </div>
        </div>
      </div>

      {currentPrices && currentPrices.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Historial de Mercado</h2>
          <ul className={styles.historyList}>
            {(() => {
              const dailyHistory = new Map();
              [...currentPrices].reverse().forEach(p => {
                const dateKey = new Date(p.created_at).toISOString().split('T')[0];
                dailyHistory.set(dateKey, p);
              });
              
              return Array.from(dailyHistory.values())
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((p: any) => (
                  <li key={p.id} className={styles.historyItem}>
                    <span className={styles.historyDate}>{formatDate(p.created_at)}</span>
                    <span className={styles.historyPrice}>
                      {formatEuro(p.median_price || p.lowest_price)}
                    </span>
                  </li>
                ));
            })()}
          </ul>
        </div>
      )}
    </div>
  );
}
  </div>
  );
}