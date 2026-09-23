"use client";

import { useMemo, useState, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import styles from "./dashboard.module.css";

import InvestmentChart from "./investment-chart";
import GenreChart from "./genre-chart";
import AnalyticsView from "./analytics";
import RandomView from "./random-view";
import SmartFoldersView from "./smart-folders";
import {
  IconVinyl, IconSearch, IconFilter, IconChevronDown, IconChevronUp, IconClose,
  IconArrowUp, IconArrowDown, IconMinus
} from "@/components/icons";
import { getFiabilidad, resumirFiabilidad } from "@/lib/confidence";
import {
  cumpleFiltros, ordenarColeccion, redondear, tokensUnicos,
  filtrosDesdeParams, ordenDesdeParams, vistaDesdeParams, construirQuery,
  type FiltrosColeccion, type OrdenColeccion, type VistaColeccion,
} from "@/lib/collection";

function DashboardInner({ latestPrices, records, snapshots, initialSmartFolders }: any) {
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  
  // 🔄 RESTAURACIÓN DE SCROLL
  useEffect(() => {
    setMounted(true);
    const savedScroll = sessionStorage.getItem("dashboardScroll");
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: "instant" });
      }, 100);
    }

    const handleScroll = () => {
      sessionStorage.setItem("dashboardScroll", window.scrollY.toString());
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Estado inicial desde la URL. Se lee una sola vez, al montar: a partir de ahí
  // manda el estado y la URL es su reflejo (ver el efecto de sincronización).
  const [filtrosIniciales] = useState(() => filtrosDesdeParams(searchParams));

  const [activeTab, setActiveTab] = useState<"collection" | "analytics" | "random" | "folders">("collection");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [search, setSearch] = useState(filtrosIniciales.search);
  const [genre, setGenre] = useState(filtrosIniciales.genre);
  const [styleFilter, setStyleFilter] = useState(filtrosIniciales.style);
  const [year, setYear] = useState(filtrosIniciales.year);
  const [labelFilter, setLabelFilter] = useState(filtrosIniciales.label);
  const [formatFilter, setFormatFilter] = useState(filtrosIniciales.format);
  const [conditionFilter, setConditionFilter] = useState(filtrosIniciales.condition);
  const [viewMode, setViewMode] = useState<VistaColeccion>(() => vistaDesdeParams(searchParams));
  const [sortBy, setSortBy] = useState<OrdenColeccion>(() => ordenDesdeParams(searchParams));
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const recordMap = useMemo(() => new Map<number, any>(records.map((r: any) => [Number(r.discogs_release_id), r])), [records]);
  
  // 📈 CÁLCULO DE TENDENCIAS
  // El precio anterior lo guarda la sincronización nocturna en la propia fila,
  // así que aquí no hay que cargar ni recorrer histórico.
  const enriched = useMemo(() => latestPrices.map((p: any) => {
    const record = recordMap.get(Number(p.release_id));
    const price = redondear(p.median_price ?? p.lowest_price);

    // Sin previous_price (fila nueva, o columna recién creada) no hay con qué
    // comparar: el anterior es el actual y la flecha queda "estable".
    const prevPrice = p.previous_price != null ? redondear(p.previous_price) : price;
    let trend: "up" | "down" | "stable" = "stable";
    if (price > prevPrice) trend = "up";
    else if (price < prevPrice) trend = "down";

    const confidence = getFiabilidad(p.num_for_sale, record?.condition_vinyl);

    return { ...p, record, price, prevPrice, trend, confidence, isRare: price >= 40 && Number(p.num_for_sale) === 0 };
  }), [latestPrices, recordMap]);

  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const totalValue = lastSnapshot?.total_value ?? enriched.reduce((sum: number, item: any) => sum + item.price, 0);
  const confidenceSummary = useMemo(() => resumirFiabilidad(enriched), [enriched]);
  const sortedByPriceItems = [...enriched].sort((a: any, b: any) => b.price - a.price);
  const maxPriceItem = sortedByPriceItems.length > 0 ? sortedByPriceItems[0] : null;
  const maxPrice = maxPriceItem ? maxPriceItem.price : 0;
  
  const sortedData = useMemo(() => ordenarColeccion(enriched, sortBy), [enriched, sortBy]);
  
  const artists = useMemo(() => Array.from(new Set(records.map((r: any) => r.artist).filter(Boolean))).sort() as string[], [records]);
  // Multivalor: un disco puede ser "Hardcore, Punk, Noise" y debe aparecer bajo
  // los tres, no solo bajo el primero.
  const genres = useMemo(() => tokensUnicos(records, "genre"), [records]);
  const stylesList = useMemo(() => tokensUnicos(records, "style"), [records]);
  const years = useMemo(() => Array.from(new Set(records.map((r: any) => String(r.year)).filter((y: string) => y && y !== "null" && y !== "0"))).sort(), [records]);
  const labelsList = useMemo(() => Array.from(new Set(records.map((r: any) => r.label).filter(Boolean))).sort(), [records]);

  const filters: FiltrosColeccion = useMemo(() => ({
    search, genre, style: styleFilter, year, label: labelFilter,
    format: formatFilter, condition: conditionFilter,
  }), [search, genre, styleFilter, year, labelFilter, formatFilter, conditionFilter]);

  // La URL refleja el estado, para que compartirla —o volver desde una ficha—
  // devuelva exactamente lo que había en pantalla.
  //
  // Se usa la History API nativa y no router.replace a propósito: la portada es
  // force-dynamic, así que un replace volvería a pedir los 1.330 discos al
  // servidor en cada tecla de la búsqueda. Next integra pushState/replaceState
  // con useSearchParams sin recargar la página.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = construirQuery(filters, sortBy, viewMode).toString();
    const destino = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (destino !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", destino);
    }
  }, [filters, sortBy, viewMode]);

  // Antes se recalculaba en cada render —cada tecla de la búsqueda recorría los
  // 1.331 discos comparando siete campos de texto—, ahora solo cuando cambia algo.
  const filtered = useMemo(
    () => sortedData.filter((item: any) => cumpleFiltros(item, filters)),
    [sortedData, filters]
  );

  let displayData = filtered;
  if (viewMode === "top10") displayData = filtered.slice(0, 10);
  else if (viewMode === "rarezas") displayData = filtered.filter((i: any) => i.isRare);

  const sectionTitle = () => {
    if (viewMode === "top10") return "Tus 10 más cotizados";
    if (viewMode === "rarezas") return "Joyas y Rarezas";
    return "Tus Joyas Analógicas";
  };

  const formatEuro = (val: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);
  const filteredTotalValue = displayData.reduce((sum: number, item: any) => sum + item.price, 0);
  const clearFilters = () => {
    setSearch(""); setGenre(""); setStyleFilter(""); setYear(""); setLabelFilter(""); setFormatFilter("all"); setConditionFilter(""); setSortBy("priceDesc"); setViewMode("all");
  };

  const tabs = (
    <div className={styles.tabsContainer} role="navigation" aria-label="Secciones">
      <button
        className={styles.hamburger}
        onClick={() => setIsMenuOpen(true)}
        aria-label="Abrir el menú"
        aria-expanded={isMenuOpen}
        aria-controls="menu-secciones"
      >
        <div className={styles.bar} />
        <div className={styles.bar} />
        <div className={styles.bar} />
      </button>
      <div id="menu-secciones" className={`${styles.tabsWrapper} ${isMenuOpen ? styles.menuOpen : ""}`}>
        {isMenuOpen && (
          <button className={styles.closeMenuBtn} onClick={() => setIsMenuOpen(false)} aria-label="Cerrar el menú">
            <IconClose className={styles.closeIcon} />
          </button>
        )}
        <button className={`${styles.tabBtn} ${activeTab === "collection" ? styles.active : ""}`} onClick={() => { setActiveTab("collection"); setIsMenuOpen(false); }}>Colección</button>
        <button className={`${styles.tabBtn} ${activeTab === "folders" ? styles.active : ""}`} onClick={() => { setActiveTab("folders"); setIsMenuOpen(false); }}>Carpetas</button>
        <button className={`${styles.tabBtn} ${activeTab === "analytics" ? styles.active : ""}`} onClick={() => { setActiveTab("analytics"); setIsMenuOpen(false); }}>Insights</button>
        <button className={`${styles.tabBtn} ${activeTab === "random" ? styles.active : ""}`} onClick={() => { setActiveTab("random"); setIsMenuOpen(false); }}>Randomize</button>
      </div>
    </div>
  );

  const FiltersContent = (
    <div className={styles.filtersWrapper}>
      <div className={styles.searchRow}>
        <div className={styles.inputWrapper}>
          <IconSearch className={styles.inputIcon} />
          <input 
            placeholder="Buscar disco o artista..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className={styles.inputSearch} 
            list="home-artists-list"
            autoComplete="off"
          />
          <datalist id="home-artists-list">
            {artists.map((a: string) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <button onClick={clearFilters} className={styles.clearFiltersBtn}>
          <IconClose className={styles.btnIcon} /> Limpiar
        </button>
      </div>
      <div className={styles.filterGroup}>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className={styles.select}>
          <option value="all">Formato</option>
          <option value="LP">LP</option>
          <option value="10in">10&quot;</option>
          <option value="7in">7&quot;</option>
          <option value="CD">CD</option>
          <option value="Cassette">Cassette</option>
          <option value="Vinilo">Otros Vinilos</option>
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className={styles.select}>
          <option value="">Género...</option>
          {genres.map((g: any) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)} className={styles.select}>
          <option value="">Estilo...</option>
          {stylesList.map((s: any) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={styles.select}>
          <option value="">Año...</option>
          {years.map((y: any) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className={styles.select}>
          <option value="">Sello...</option>
          {labelsList.map((l: any) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className={styles.select}>
          <option value="">Estado...</option>
          <option value="Mint (M)">Mint (M)</option>
          <option value="Near Mint (NM or M-)">Near Mint (NM)</option>
          <option value="Very Good Plus (VG+)">Very Good Plus (VG+)</option>
          <option value="Very Good (VG)">Very Good (VG)</option>
          <option value="Good Plus (G+)">Good Plus (G+)</option>
          <option value="Good (G)">Good (G)</option>
          <option value="Fair (F)">Fair (F)</option>
          <option value="Poor (P)">Poor (P)</option>
          <option value="__unknown__">Sin datos en Discogs</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={styles.select}>
          <option value="priceDesc">Mayor precio</option><option value="priceAsc">Menor precio</option><option value="artistAsc">A-Z</option><option value="yearDesc">Más reciente</option>
        </select>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className={styles.select}>
          <option value="all">Ver Colección</option><option value="top10">Top 10</option><option value="rarezas">Rarezas</option>
        </select>
      </div>
    </div>
  );

  // Mismo constructor que usa la sincronización de la URL, para que lo que se
  // envía a la ficha y lo que se recupera al volver no puedan divergir.
  const getReleaseUrl = (releaseId: any) => {
    const qs = construirQuery(filters, sortBy, viewMode).toString();
    return `/release/${releaseId}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={styles.dashboardRoot}>
      {mounted && document.getElementById("header-portal") ? createPortal(tabs, document.getElementById("header-portal")!) : null}

      {activeTab === "collection" ? (
        <>
          <div className={styles.homeChart}><InvestmentChart snapshots={snapshots} /></div>
          <div className={styles.kpiGrid}>
            <KPI
              label="Valor Total Colección"
              value={formatEuro(totalValue)}
              subText={confidenceSummary.discos > 0
                ? `${formatEuro(confidenceSummary.firme.valor)} sobre mercado contrastado`
                : ""}
            />
            <KPI label="Disco Más Caro" value={formatEuro(maxPrice)} subText={maxPriceItem ? `${maxPriceItem.record?.artist} - ${maxPriceItem.record?.title}` : ""} />
            <KPI label="Total Discos" value={`${records.length}`} />
          </div>

          <div className={styles.desktopFiltersOnly}>
            {FiltersContent}
          </div>

          <div className={styles.mobileAccordionOnly}>
            <button
              className={styles.accordionToggle}
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              aria-expanded={showFiltersMobile}
              aria-controls="filtros-movil"
            >
              <span className={styles.toggleLabel}>
                <IconFilter className={styles.btnIcon} /> {showFiltersMobile ? "Ocultar Filtros" : "Filtros y Búsqueda"}
              </span>
              {showFiltersMobile ? <IconChevronUp className={styles.toggleIcon} /> : <IconChevronDown className={styles.toggleIcon} />}
            </button>
            <div id="filtros-movil">{showFiltersMobile && FiltersContent}</div>
          </div>

          <h2 className={styles.sectionTitle}>
            <div className={styles.titleText}>{sectionTitle()} <span className={styles.recordCountBadge}>{displayData.length}</span></div>
            <div className={styles.filteredValue}>Total selección: <span>{formatEuro(filteredTotalValue)}</span></div>
          </h2>
          {displayData.length === 0 ? (
            <div className={styles.emptyGrid}>
              <IconSearch className={styles.emptyGridIcon} />
              <h3 className={styles.emptyGridTitle}>
                {viewMode === "rarezas"
                  ? "Ninguna rareza con estos filtros"
                  : "Ningún disco coincide"}
              </h3>
              <p className={styles.emptyGridText}>
                {viewMode === "rarezas"
                  ? "Las rarezas son discos de 40 € o más que ahora mismo no vende nadie. Prueba a quitar algún filtro."
                  : "Hay 1.330 discos en la colección, pero ninguno cumple lo que has pedido. Prueba a quitar algún filtro."}
              </p>
              <button onClick={clearFilters} className={styles.emptyGridBtn}>
                <IconClose className={styles.btnIcon} /> Quitar todos los filtros
              </button>
            </div>
          ) : (
          <div className={styles.grid}>
            {displayData.map((item: any) => (
              <a key={item.release_id} href={getReleaseUrl(item.release_id)} className={styles.card}>
                <div className={styles.coverWrapper}>
                  {item.record?.cover_image ? (
                    <img
                      src={item.record.cover_image}
                      alt=""
                      className={styles.coverImg}
                      loading="lazy"
                      decoding="async"
                      width={320}
                      height={320}
                    />
                  ) : (
                    <IconVinyl className={styles.coverPlaceholderIcon} />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.recordArtist}>{item.record?.artist}</div>
                  <div className={styles.recordTitle}>{item.record?.title}</div>
                  <div className={styles.recordPrice}>
                    <span className={styles.priceWithDot}>
                      <i
                        className={`${styles.confDot} ${styles["conf" + item.confidence.nivel.charAt(0).toUpperCase() + item.confidence.nivel.slice(1)]}`}
                        title={`${item.confidence.etiqueta} — ${item.confidence.motivo}`}
                        aria-label={`Fiabilidad: ${item.confidence.etiqueta}. ${item.confidence.motivo}`}
                      />
                      {formatEuro(item.price)}
                    </span>
                    <div className={`${styles.trendIndicator} ${styles["trend" + item.trend.charAt(0).toUpperCase() + item.trend.slice(1)]}`}>
                      {item.trend === "up" && <IconArrowUp className={styles.trendIcon} />}
                      {item.trend === "down" && <IconArrowDown className={styles.trendIcon} />}
                      {item.trend === "stable" && <IconMinus className={styles.trendIcon} />}
                      <span>{item.prevPrice > 0 ? formatEuro(item.prevPrice) : "--"}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
          )}
        </>
      ) : activeTab === "folders" ? (
        <SmartFoldersView records={records} enriched={enriched} initialSmartFolders={initialSmartFolders} />
      ) : activeTab === "analytics" ? (
        <AnalyticsView records={records} enriched={enriched} />
      ) : (
        <RandomView records={records} />
      )}
    </div>
  );
}

export default function ClientDashboard(props: any) {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#fff' }}>Cargando colección...</div>}>
      <DashboardInner {...props} />
    </Suspense>
  );
}

function KPI({ label, value, subText }: any) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {subText && <div className={styles.kpiSubText}>{subText}</div>}
    </div>
  );
}