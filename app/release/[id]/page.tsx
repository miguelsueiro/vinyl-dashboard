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

  // 1. Obtener navegación
  const { data: navData } = await supabase
    .from("records")
    .select("discogs_release_id, artist, title, year, genre, style, label, format");

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

  const sortBy = (sp.sort as string) || "priceDesc";
  if (sortBy === "artistAsc") filteredIds.sort((a,b) => (a.artist || "").localeCompare(b.artist || ""));
  else if (sortBy === "yearDesc") filteredIds.sort((a,b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

  const navIds = filteredIds.map(f => f.discogs_release_id);
  const currentIndex = navIds.indexOf(parseInt(id, 10));
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = (currentIndex !== -1 && currentIndex < navIds.length - 1) ? navIds[currentIndex + 1] : null;

  // 2. Cargar datos del disco
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

  // Fetch extra data from Discogs API (SSR)
  let discogsRelease: any = null;
  try {
    const discogsRes = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: {
        "Authorization": `Discogs token=${process.env.DISCOGS_TOKEN}`,
        "User-Agent": "VinylIntelligence/1.1"
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    if (discogsRes.ok) discogsRelease = await discogsRes.json();
  } catch (e) {
    // silently fail
  }

  if (!recordsData) {
    return (
      <div className={styles.releaseRoot}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Disco no encontrado</h2>
          <Link href="/" className={styles.backBtn} style={{ marginTop: 20 }}>← Volver</Link>
        </div>
      </div>
    );
  }

  const latestPrice = currentPrices?.[0] || {};
  const currentPriceVal = Math.round((latestPrice.median_price || latestPrice.lowest_price || 0) * 100) / 100;

  const prevPriceEntry = currentPrices?.find(p => {
    const pVal = Math.round((p.median_price || p.lowest_price || 0) * 100) / 100;
    return pVal !== currentPriceVal;
  }) || currentPrices?.[1];
  
  const prevPrice = Math.round((prevPriceEntry ? (prevPriceEntry.median_price || prevPriceEntry.lowest_price) : currentPriceVal) * 100) / 100;
  
  let trend = "stable";
  if (currentPriceVal > prevPrice) trend = "up";
  else if (currentPriceVal < prevPrice) trend = "down";

  const discogsLink = `https://www.discogs.com/release/${id}`;

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
            <span>{formatEuro(currentPriceVal)}</span>
            <div className={styles.trendContainer}>
              <div className={`${styles.trendIndicator} ${styles["trend" + trend.charAt(0).toUpperCase() + trend.slice(1)]}`}>
                {trend === "up" && <IconArrowUp className={styles.trendIcon} />}
                {trend === "down" && <IconArrowDown className={styles.trendIcon} />}
                {trend === "stable" && <IconMinus className={styles.trendIcon} />}
                <span>{trend === "stable" ? "Estable" : formatEuro(Math.abs(currentPriceVal - prevPrice))}</span>
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
              const displayedEntries: any[] = [];
              let lastPrice = -1;

              [...currentPrices].reverse().forEach((p, index) => {
                const pVal = Math.round((p.median_price || p.lowest_price) * 100) / 100;
                if (index === 0 || index === currentPrices.length - 1 || pVal !== lastPrice) {
                  displayedEntries.push(p);
                  lastPrice = pVal;
                }
              });

              return displayedEntries.reverse().map((p: any, i: number) => {
                const pVal = Math.round((p.median_price || p.lowest_price) * 100) / 100;
                const nextEntry = i < displayedEntries.length - 1 ? displayedEntries[i+1] : null;
                const nextPrice = nextEntry ? Math.round((nextEntry.median_price || nextEntry.lowest_price) * 100) / 100 : pVal;
                
                let itemTrend = "stable";
                if (pVal > nextPrice) itemTrend = "up";
                else if (pVal < nextPrice) itemTrend = "down";

                return (
                  <li key={p.id} className={styles.historyItem}>
                    <span className={styles.historyDate}>{formatDate(p.created_at)}</span>
                    <div className={`${styles.trendIndicator} ${styles["trend" + itemTrend.charAt(0).toUpperCase() + itemTrend.slice(1)]}`} style={{ padding: '6px 12px' }}>
                         {itemTrend === "up" && <IconArrowUp className={styles.trendIcon} />}
                         {itemTrend === "down" && <IconArrowDown className={styles.trendIcon} />}
                         {itemTrend === "stable" && i < displayedEntries.length - 1 && <IconMinus className={styles.trendIcon} />}
                         <span style={{ fontWeight: 'bold' }}>{formatEuro(pVal)}</span>
                    </div>
                  </li>
                );
              });
            })()}
          </ul>
        </div>
      )}

      {/* DISCOGS EXTRA INFO */}
      {discogsRelease && (
        <div className={styles.extraInfo}>

          {/* METADATA ROW: Country, Released, Catalog */}
          <div className={styles.metaRow}>
            {discogsRelease.country && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>País</span>
                <span className={styles.metaValue}>{discogsRelease.country}</span>
              </div>
            )}
            {discogsRelease.released && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Publicado</span>
                <span className={styles.metaValue}>{discogsRelease.released}</span>
              </div>
            )}
            {discogsRelease.labels?.[0]?.catno && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Catálogo</span>
                <span className={styles.metaValue}>{discogsRelease.labels[0].catno}</span>
              </div>
            )}
            {discogsRelease.num_for_sale !== undefined && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>En venta en Discogs</span>
                <span className={styles.metaValue}>{discogsRelease.num_for_sale} copias</span>
              </div>
            )}
          </div>

          <div className={styles.extraColumns}>
            {/* TRACKLIST */}
            {discogsRelease.tracklist?.length > 0 && (
              <div className={styles.extraSection}>
                <h3 className={styles.extraTitle}>Tracklist</h3>
                <ol className={styles.tracklist}>
                  {discogsRelease.tracklist.map((track: any, i: number) => (
                    <li key={i} className={`${styles.trackItem} ${track.type_ === 'heading' ? styles.trackHeading : ''}`}>
                      {track.type_ !== 'heading' && (
                        <span className={styles.trackPos}>{track.position || ''}</span>
                      )}
                      <span className={styles.trackTitle}>{track.title}</span>
                      {track.duration && <span className={styles.trackDur}>{track.duration}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className={styles.extraRight}>
              {/* CREDITS */}
              {discogsRelease.extraartists?.length > 0 && (
                <div className={styles.extraSection}>
                  <h3 className={styles.extraTitle}>Créditos</h3>
                  <ul className={styles.creditsList}>
                    {discogsRelease.extraartists.map((credit: any, i: number) => (
                      <li key={i} className={styles.creditItem}>
                        <span className={styles.creditRole}>{credit.role}</span>
                        <span className={styles.creditName}>{credit.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* NOTES */}
              {discogsRelease.notes && (
                <div className={styles.extraSection}>
                  <h3 className={styles.extraTitle}>Notas</h3>
                  <p className={styles.notes}>{discogsRelease.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}