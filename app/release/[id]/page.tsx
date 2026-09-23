import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import styles from "./release.module.css";
import StreamingSection from "./streaming-section";
import KeyboardNav from "./keyboard-nav";
import {
  IconVinyl, IconChevronLeft, IconChevronRight,
  IconArrowUp, IconArrowDown, IconMinus
} from "@/components/icons";
import { getFiabilidad } from "@/lib/confidence";
import {
  vecinos, filtrosDesdeParams, ordenDesdeParams, calcularTendencia, redondear,
} from "@/lib/collection";
import type {
  Disco, PrecioActual, PrecioHistorico, ReleaseDiscogs, PistaDiscogs, CreditoDiscogs,
} from "@/lib/types";

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

  // 1. Obtener navegación.
  //
  // Hay que paginar: Supabase corta en 1.000 filas y la colección pasa de eso,
  // así que antes los discos que quedaban fuera no tenían flechas (indexOf daba
  // -1 y las dos salían muertas). Y hacen falta los precios, porque el orden por
  // defecto es por precio y sin ellos la ficha navegaba en otro orden distinto
  // del que el usuario tenía en pantalla.
  const fetchAll = async <T,>(table: string, columns: string): Promise<T[]> => {
    let all: T[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.from(table).select(columns).range(offset, offset + 999);
      if (error) {
        // Un fallo a medias devolvería una lista incompleta y las flechas
        // saltarían discos sin avisar. Mejor dejar constancia.
        console.error(`❌ Error leyendo ${table} para la navegación:`, error.message);
        break;
      }
      if (!data) break;
      all = all.concat(data as T[]);
      if (data.length < 1000) break;
      offset += 1000;
    }
    return all;
  };

  const [navRecords, navPrices] = await Promise.all([
    fetchAll<Disco>("records", "discogs_release_id, artist, title, year, genre, style, label, format, condition_vinyl, condition_sleeve"),
    fetchAll<PrecioActual>("latest_prices", "release_id, median_price, lowest_price"),
  ]);

  const priceByRelease = new Map<number, number>(
    navPrices.map((p) => [Number(p.release_id), redondear(p.median_price ?? p.lowest_price)])
  );

  const navItems = navRecords.map((r) => ({
    release_id: Number(r.discogs_release_id),
    price: priceByRelease.get(Number(r.discogs_release_id)) ?? 0,
    record: r,
  }));

  const { anterior: prevId, siguiente: nextId, posicion, total: totalEnLista } =
    vecinos(navItems, filtrosDesdeParams(sp), ordenDesdeParams(sp), id);

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
  let discogsRelease: ReleaseDiscogs | null = null;
  try {
    const discogsRes = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: {
        "Authorization": `Discogs token=${process.env.DISCOGS_TOKEN}`,
        "User-Agent": "VinylIntelligence/1.1"
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    if (discogsRes.ok) discogsRelease = await discogsRes.json();
  } catch {
    // Si Discogs falla, la ficha se pinta igual sin tracklist ni créditos.
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
  const currentPriceVal = redondear(latestPrice.median_price ?? latestPrice.lowest_price);

  // Misma regla que la portada: la lectura inmediatamente anterior. Antes esta
  // vista buscaba el último precio DISTINTO —que podía ser de hace meses— y
  // enseñaba esa diferencia como si fuera el cambio del día, así que el mismo
  // disco podía salir "estable" en la portada y con una subida grande aquí.
  const { precioAnterior: prevPrice, tendencia: trend } =
    calcularTendencia(currentPriceVal, currentPrices || []);

  // Cuánto respaldo de mercado real tiene esa cifra (ver lib/confidence.ts).
  // Preferimos el nº de copias que Discogs da ahora mismo; si la llamada falló,
  // caemos al que quedó guardado en el último precio.
  const copiasALaVenta = discogsRelease?.num_for_sale ?? latestPrice.num_for_sale;
  const fiabilidad = getFiabilidad(copiasALaVenta, recordsData.condition_vinyl);

  const discogsLink = `https://www.discogs.com/release/${id}`;

  const formatDate = (dateString: string) => {
    if (!dateString) return "Fecha desconocida";
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateString));
  };

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(val);
  };

  const getNavUrl = (newId: string | number) => {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([key, value]) => {
      if (value) params.set(key, value.toString());
    });
    return `/release/${newId}${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div className={styles.releaseRoot}>
      <KeyboardNav
        prevUrl={prevId ? getNavUrl(prevId) : null}
        nextUrl={nextId ? getNavUrl(nextId) : null}
      />
      <div className={styles.navRow}>
        <Link href={`/${new URLSearchParams(sp as Record<string, string>).toString() ? `?${new URLSearchParams(sp as Record<string, string>).toString()}` : ""}`} className={styles.backBtn}>
          <span>←</span> Volver
        </Link>
        <nav className={styles.quickNav} aria-label="Navegar por la colección">
          {prevId ? (
            <Link href={getNavUrl(prevId)} className={styles.navBtn} title="Disco anterior (flecha izquierda)" aria-label="Disco anterior" rel="prev">
              <IconChevronLeft className={styles.navIcon} />
            </Link>
          ) : (
            <div className={`${styles.navBtn} ${styles.disabled}`} aria-hidden="true"><IconChevronLeft className={styles.navIcon} /></div>
          )}

          {/* La posición ya se calculaba y no se enseñaba en ninguna parte. */}
          {posicion > 0 && (
            <span className={styles.navPosition} aria-live="polite">
              {posicion} <span className={styles.navPositionOf}>de</span> {totalEnLista}
            </span>
          )}

          {nextId ? (
            <Link href={getNavUrl(nextId)} className={styles.navBtn} title="Disco siguiente (flecha derecha)" aria-label="Disco siguiente" rel="next">
              <IconChevronRight className={styles.navIcon} />
            </Link>
          ) : (
            <div className={`${styles.navBtn} ${styles.disabled}`} aria-hidden="true"><IconChevronRight className={styles.navIcon} /></div>
          )}
        </nav>
      </div>
      
      <div className={styles.topSection}>
        <div className={styles.coverBox}>
          {recordsData.cover_image ? (
            <img
              src={recordsData.cover_image}
              alt={`Portada de ${recordsData.artist ?? ""} – ${recordsData.title ?? ""}`}
              className={styles.coverImage}
              width={600}
              height={600}
              fetchPriority="high"
            />
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

            {/* El precio es lo que se viene a mirar: va arriba, junto a la
                portada. Antes quedaba por debajo del tracklist, los créditos y
                las notas, y había que bajar bastante para verlo. */}
            <div className={styles.priceBlock}>
              <div className={styles.priceLabel}>Valor estimado de mercado</div>
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

              <div className={`${styles.confidenceRow} ${styles["conf" + fiabilidad.nivel.charAt(0).toUpperCase() + fiabilidad.nivel.slice(1)]}`}>
                <span className={styles.confDot} />
                <span className={styles.confLabel}>{fiabilidad.etiqueta}</span>
                <span className={styles.confReason}>{fiabilidad.motivo}</span>
              </div>
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
            {(discogsRelease.tracklist?.length ?? 0) > 0 && (
              <div className={styles.extraSection}>
                <h3 className={styles.extraTitle}>Tracklist</h3>
                <ol className={styles.tracklist}>
                  {discogsRelease.tracklist!.map((track: PistaDiscogs, i: number) => (
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
              {(discogsRelease.extraartists?.length ?? 0) > 0 && (
                <div className={styles.extraSection}>
                  <h3 className={styles.extraTitle}>Créditos</h3>
                  <ul className={styles.creditsList}>
                    {discogsRelease.extraartists!.map((credit: CreditoDiscogs, i: number) => (
                      <li key={i} className={styles.creditItem}>
                        <span className={styles.creditRole}>{credit.role}</span>
                        <span className={styles.creditName}>{credit.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* NOTES — third column on desktop */}
            {discogsRelease.notes && (
              <div className={styles.notesColumn}>
                <div className={styles.extraSection}>
                  <h3 className={styles.extraTitle}>Notas</h3>
                  <p className={styles.notes}>{discogsRelease.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {currentPrices && currentPrices.length > 0 && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>Historial de Variaciones</h2>
          <ul className={styles.historyList}>
            {(() => {
              const displayedEntries: PrecioHistorico[] = [];
              let lastPrice = -1;

              [...currentPrices].reverse().forEach((p, index) => {
                const pVal = redondear(p.median_price ?? p.lowest_price);
                if (index === 0 || index === currentPrices.length - 1 || pVal !== lastPrice) {
                  displayedEntries.push(p);
                  lastPrice = pVal;
                }
              });

              return displayedEntries.reverse().map((p, i) => {
                const pVal = redondear(p.median_price ?? p.lowest_price);
                const nextEntry = i < displayedEntries.length - 1 ? displayedEntries[i+1] : null;
                const nextPrice = nextEntry ? redondear(nextEntry.median_price ?? nextEntry.lowest_price) : pVal;
                
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


    </div>
  );
}