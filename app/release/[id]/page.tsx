import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import styles from "./release.module.css";
import StreamingSection from "./streaming-section";
import { 
  IconVinyl, IconChevronLeft, IconChevronRight, 
  IconArrowUp, IconArrowDown, IconMinus 
} from "@/components/icons";

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

  // ... (mismo código de navegación y carga de datos hasta currentPrices)
  
  // Obtenemos solo los IDs para navegar sin cargar 1300+ objetos completos
  const { data: navData } = await supabase
    .from("records")
    .select("discogs_release_id, artist, title, year, genre, style, label, format");

  // Aplicamos la misma lógica de filtrado que en la home pero en memoria
  let filteredIds = (navData || []).filter((r: any) => {
    const q = (sp.search as string || "").toLowerCase();
    const matchSearch = r.artist?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.discogs_release_id.toString().includes(q);
    const matchGenre = !sp.genre || r.genre?.toLowerCase().includes((sp.genre as string).trim().toLowerCase());
    const matchStyle = !sp.style || r.style?.toLowerCase().includes((sp.style as string).trim().toLowerCase());
    const matchYear = !sp.year || String(r.year) === (sp.year as string).trim();
    const matchLabel = !sp.label || r.label?.toLowerCase().includes((sp.label as string).trim().toLowerCase());
    
    let rawFormat = r.format?.toLowerCase() || "";
    let itemFormatGroup = "Vinilo";
    if (rawFormat.includes("cd")) itemFormatGroup = "CD";
    if (rawFormat.includes("cassette")) itemFormatGroup = "Cassette";
    
    return matchSearch && matchGenre && matchStyle && matchYear && matchLabel && (!sp.format || sp.format === "all" || itemFormatGroup === sp.format);
  });

  // Sort rápido para la navegación
  const sortBy = (sp.sort as string) || "priceDesc";
  if (sortBy === "artistAsc") filteredIds.sort((a,b) => (a.artist || "").localeCompare(b.artist || ""));
  else if (sortBy === "yearDesc") filteredIds.sort((a,b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

  const navIds = filteredIds.map(f => f.discogs_release_id);
  const currentIndex = navIds.indexOf(parseInt(id, 10));
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = (currentIndex !== -1 && currentIndex < navIds.length - 1) ? navIds[currentIndex + 1] : null;

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
  const prevPriceEntry = currentPrices?.find(p => (p.median_price || p.lowest_price) !== (latestPrice.median_price || latestPrice.lowest_price)) || currentPrices?.[1];
  const prevPrice = prevPriceEntry ? (prevPriceEntry.median_price || prevPriceEntry.lowest_price) : (latestPrice.median_price || latestPrice.lowest_price);
  
  let trend = "stable";
  if ((latestPrice.median_price || latestPrice.lowest_price) > prevPrice) trend = "up";
  else if ((latestPrice.median_price || latestPrice.lowest_price) < prevPrice) trend = "down";

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
              {recordsData.format && recordsData.format.split(",").map((f: string) => f.trim()).filter(Boolean).map((f: string) => (
                <span key={f} className={styles.tag}>{f}</span>
              ))}
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
            <span>{formatEuro(latestPrice.median_price || latestPrice.lowest_price || 0)}</span>
            <div className={styles.trendContainer}>
              <div className={`${styles.trendIndicator} ${styles["trend" + trend.charAt(0).toUpperCase() + trend.slice(1)]}`}>
                {trend === "up" && <IconArrowUp className={styles.trendIcon} />}
                {trend === "down" && <IconArrowDown className={styles.trendIcon} />}
                {trend === "stable" && <IconMinus className={styles.trendIcon} />}
                <span>{trend === "stable" ? "Estable" : formatEuro(Math.abs((latestPrice.median_price || latestPrice.lowest_price) - prevPrice))}</span>
              </div>
              {trend !== "stable" && <div className={styles.prevPrice}>Anterior: {formatEuro(prevPrice)}</div>}
            </div>
          </div>
        </div>
      </div>

      {currentPrices && currentPrices.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Historial de Variaciones</h2>
          <ul className={styles.historyList}>
            {(() => {
              // Agrupado inteligente: Solo mostrar si el precio cambió
              const displayedEntries: any[] = [];
              let lastDisplayedPrice = -1;

              [...currentPrices].reverse().forEach((p, index) => {
                const currentPrice = p.median_price || p.lowest_price;
                // Siempre mostramos el primero, el último, y cualquier cambio intermedio
                if (index === 0 || index === currentPrices.length - 1 || currentPrice !== lastDisplayedPrice) {
                  displayedEntries.push(p);
                  lastDisplayedPrice = currentPrice;
                }
              });

              return displayedEntries.reverse().map((p: any, i: number) => {
                const currentPrice = p.median_price || p.lowest_price;
                const nextEntry = i < displayedEntries.length - 1 ? displayedEntries[i+1] : null;
                const nextPrice = nextEntry ? (nextEntry.median_price || nextEntry.lowest_price) : currentPrice;
                
                let itemTrend = "stable";
                if (currentPrice > nextPrice) itemTrend = "up";
                else if (currentPrice < nextPrice) itemTrend = "down";

                return (
                  <li key={p.id} className={styles.historyItem}>
                    <span className={styles.historyDate}>{formatDate(p.created_at)}</span>
                    <span className={`${styles.historyPrice} ${styles["trend" + itemTrend.charAt(0).toUpperCase() + itemTrend.slice(1)]}`} style={{ background: 'transparent', padding: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {itemTrend === "up" && <IconArrowUp className={styles.trendIcon} />}
                         {itemTrend === "down" && <IconArrowDown className={styles.trendIcon} />}
                         {itemTrend === "stable" && i < displayedEntries.length - 1 && <IconMinus className={styles.trendIcon} />}
                         {formatEuro(currentPrice)}
                      </div>
                    </span>
                  </li>
                );
              });
            })()}
          </ul>
        </div>
      )}
    </div>
  );
}