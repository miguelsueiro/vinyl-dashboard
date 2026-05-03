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

  // 1. Obtener todos los datos necesarios para recrear el estado del listado
  // (Replica la lógica de Home y UI para ser coherente con los filtros)
  let allRecords: any[] = [];
  let fetched = 1000;
  let offset = 0;
  while(fetched === 1000) {
    const { data } = await supabase.from("records").select("*").range(offset, offset + 999);
    if(data && data.length > 0) {
      allRecords = allRecords.concat(data);
      fetched = data.length;
      offset += 1000;
    } else {
      fetched = 0;
    }
  }

  let allPrices: any[] = [];
  let fetchedPrices = 1000;
  let offsetPrices = 0;
  while(fetchedPrices === 1000) {
    const { data } = await supabase.from("market_prices").select("*").order("created_at", { ascending: false }).range(offsetPrices, offsetPrices + 999);
    if(data && data.length > 0) {
      allPrices = allPrices.concat(data);
      fetchedPrices = data.length;
      offsetPrices += 1000;
    } else {
      fetchedPrices = 0;
    }
  }

  // 2. Mapear y procesar como en UI.tsx
  const latestPricesMap = new Map();
  allPrices?.forEach((p: any) => {
    if (!latestPricesMap.has(p.release_id)) latestPricesMap.set(p.release_id, p);
  });

  const recordMap = new Map(allRecords.map((r: any) => [r.discogs_release_id, r]));
  
  // Recreamos 'enriched'
  let enriched = Array.from(latestPricesMap.values()).map((p: any) => {
    const record = recordMap.get(p.release_id);
    let price = p.median_price || p.lowest_price || 0;
    return { ...p, record, price, isRare: price >= 40 && Number(p.num_for_sale) === 0 };
  });

  // 3. Aplicar Filtros y Sort (mismos que en ui.tsx)
  const search = (sp.search as string) || "";
  const genre = (sp.genre as string) || "";
  const styleFilter = (sp.style as string) || "";
  const year = (sp.year as string) || "";
  const labelFilter = (sp.label as string) || "";
  const formatFilter = (sp.format as string) || "all";
  const sortBy = (sp.sort as string) || "priceDesc";
  const viewMode = (sp.view as string) || "all";

  // Sort
  if (sortBy === "priceDesc") enriched.sort((a,b) => b.price - a.price);
  else if (sortBy === "priceAsc") enriched.sort((a,b) => a.price - b.price);
  else if (sortBy === "artistAsc") enriched.sort((a,b) => (a.record?.artist || "").localeCompare(b.record?.artist || ""));
  else if (sortBy === "yearDesc") enriched.sort((a,b) => (parseInt(b.record?.year) || 0) - (parseInt(a.record?.year) || 0));

  // Filter
  let filtered = enriched.filter((item: any) => {
    const q = search.toLowerCase();
    const matchSearch = item.record?.artist?.toLowerCase().includes(q) || item.record?.title?.toLowerCase().includes(q) || item.release_id.toString().includes(q);
    const matchGenre = !genre || item.record?.genre?.toLowerCase().includes(genre.trim().toLowerCase());
    const matchStyle = !styleFilter || item.record?.style?.toLowerCase().includes(styleFilter.trim().toLowerCase());
    const matchYear = !year || String(item.record?.year) === year.trim();
    const matchLabel = !labelFilter || item.record?.label?.toLowerCase().includes(labelFilter.trim().toLowerCase());
    
    let rawFormat = item.record?.format?.toLowerCase() || "";
    let itemFormatGroup = "Vinilo";
    if (rawFormat.includes("cd")) itemFormatGroup = "CD";
    if (rawFormat.includes("cassette")) itemFormatGroup = "Cassette";
    
    return matchSearch && matchGenre && matchStyle && matchYear && matchLabel && (formatFilter === "all" || itemFormatGroup === formatFilter);
  });

  if (viewMode === "top10") filtered = filtered.slice(0, 10);
  else if (viewMode === "rarezas") filtered = filtered.filter((i: any) => i.isRare);

  // 4. Encontrar vecinos
  const navIds = filtered.map(f => f.release_id);
  const currentIndex = navIds.indexOf(parseInt(id, 10));
  const prevId = currentIndex > 0 ? navIds[currentIndex - 1] : null;
  const nextId = (currentIndex !== -1 && currentIndex < navIds.length - 1) ? navIds[currentIndex + 1] : null;

  // 5. Datos para la ficha actual
  const recordsData = recordMap.get(parseInt(id, 10));
  const currentPrices = allPrices.filter(p => p.release_id === parseInt(id, 10));
  const latestPrice = currentPrices[0] || {};
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
              {recordsData.style && <Link href={`/?style=${encodeURIComponent(recordsData.style)}`} className={styles.tag}>{recordsData.style}</Link>}
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
            {currentPrices.map((p: any) => (
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