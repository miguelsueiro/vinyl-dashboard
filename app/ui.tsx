"use client";

import { useMemo, useState, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import styles from "./dashboard.module.css";

import InvestmentChart from "./investment-chart";
import GenreChart from "./genre-chart";
import AnalyticsView from "./analytics";
import RandomView from "./random-view";
import { 
  IconVinyl, IconSearch, IconFilter, IconChevronDown, IconChevronUp, IconClose 
} from "@/components/icons";

function DashboardInner({ latestPrices, historicalPrices, records, snapshots }: any) {
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeTab, setActiveTab] = useState<"collection" | "analytics" | "random">("collection");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState(searchParams.get("genre") || "");
  const [styleFilter, setStyleFilter] = useState(searchParams.get("style") || "");
  const [year, setYear] = useState(searchParams.get("year") || "");
  const [labelFilter, setLabelFilter] = useState(searchParams.get("label") || "");
  const [formatFilter, setFormatFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"all" | "top10" | "rarezas">("all");
  const [sortBy, setSortBy] = useState<"priceDesc" | "priceAsc" | "artistAsc" | "yearDesc">("priceDesc");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const recordMap = useMemo(() => new Map(records.map((r: any) => [r.discogs_release_id, r])), [records]);
  const enriched = useMemo(() => latestPrices.map((p: any) => {
    const record = recordMap.get(p.release_id);
    let price = p.median_price || p.lowest_price || 0;
    if (!price) {
      const past = historicalPrices.filter((h: any) => h.release_id === p.release_id && (h.median_price || h.lowest_price));
      if (past.length > 0) price = past[0].median_price || past[0].lowest_price;
    }
    return { ...p, record, price, isRare: price >= 40 && Number(p.num_for_sale) === 0 };
  }), [latestPrices, recordMap, historicalPrices]);

  const totalValue = enriched.reduce((sum: number, item: any) => sum + item.price, 0);
  const sortedByPriceItems = [...enriched].sort((a,b) => b.price - a.price);
  const maxPriceItem = sortedByPriceItems.length > 0 ? sortedByPriceItems[0] : null;
  const maxPrice = maxPriceItem ? maxPriceItem.price : 0;
  
  const sortedData = useMemo(() => {
    const data = [...enriched];
    if (sortBy === "priceDesc") return data.sort((a: any, b: any) => b.price - a.price);
    if (sortBy === "priceAsc") return data.sort((a: any, b: any) => a.price - b.price);
    if (sortBy === "artistAsc") return data.sort((a: any, b: any) => (a.record?.artist || "").localeCompare(b.record?.artist || ""));
    if (sortBy === "yearDesc") return data.sort((a: any, b: any) => (parseInt(b.record?.year) || 0) - (parseInt(a.record?.year) || 0));
    return data;
  }, [enriched, sortBy]);
  
  const genres = useMemo(() => Array.from(new Set(records.map((r: any) => r.genre).filter(Boolean))).sort(), [records]);
  const stylesList = useMemo(() => Array.from(new Set(records.map((r: any) => r.style).filter(Boolean))).sort(), [records]);
  const years = useMemo(() => Array.from(new Set(records.map((r: any) => String(r.year)).filter((y: string) => y && y !== "null" && y !== "0"))).sort(), [records]);
  const labelsList = useMemo(() => Array.from(new Set(records.map((r: any) => r.label).filter(Boolean))).sort(), [records]);

  const filtered = sortedData.filter((item: any) => {
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

  let displayData = filtered;
  if (viewMode === "top10") displayData = filtered.slice(0, 10);
  else if (viewMode === "rarezas") displayData = filtered.filter((i) => i.isRare);

  const sectionTitle = () => {
    if (viewMode === "top10") return "Tus 10 más cotizados";
    if (viewMode === "rarezas") return "Joyas y Rarezas";
    return "Tus Joyas Analógicas";
  };

  const formatEuro = (val: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);
  const filteredTotalValue = displayData.reduce((sum: number, item: any) => sum + item.price, 0);
  const clearFilters = () => {
    setSearch(""); setGenre(""); setStyleFilter(""); setYear(""); setLabelFilter(""); setFormatFilter("all"); setSortBy("priceDesc"); setViewMode("all");
  };

  const tabs = (
    <div className={styles.tabsContainer}>
      <button className={styles.hamburger} onClick={() => setIsMenuOpen(true)}>
        <div className={styles.bar} />
        <div className={styles.bar} />
        <div className={styles.bar} />
      </button>
      <div className={`${styles.tabsWrapper} ${isMenuOpen ? styles.menuOpen : ""}`}>
        {isMenuOpen && (
          <button className={styles.closeMenuBtn} onClick={() => setIsMenuOpen(false)}>
            <IconClose className={styles.closeIcon} />
          </button>
        )}
        <button className={`${styles.tabBtn} ${activeTab === "collection" ? styles.active : ""}`} onClick={() => { setActiveTab("collection"); setIsMenuOpen(false); }}>Colección</button>
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
          <input placeholder="Buscar disco o artista..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.inputSearch} />
        </div>
        <button onClick={clearFilters} className={styles.clearFiltersBtn}>
          <IconClose className={styles.btnIcon} /> Limpiar
        </button>
      </div>
      <div className={styles.filterGroup}>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className={styles.select}>
          <option value="all">Formato</option><option value="Vinilo">Vinilo</option><option value="CD">CD</option>
        </select>
        <input list="genres-list" className={styles.inputDatalist} placeholder="Género..." value={genre} onFocus={() => setGenre("")} onChange={(e) => setGenre(e.target.value)} />
        <datalist id="genres-list">{genres.map((g: any) => <option key={g} value={g} />)}</datalist>
        <input list="styles-list" className={styles.inputDatalist} placeholder="Estilo..." value={styleFilter} onFocus={() => setStyleFilter("")} onChange={(e) => setStyleFilter(e.target.value)} />
        <datalist id="styles-list">{stylesList.map((s: any) => <option key={s} value={s} />)}</datalist>
        <input list="years-list" className={styles.inputDatalist} placeholder="Año..." value={year} onFocus={() => setYear("")} onChange={(e) => setYear(e.target.value)} />
        <datalist id="years-list">{years.map((y: any) => <option key={y} value={y} />)}</datalist>
        <input list="labels-list" className={styles.inputDatalist} placeholder="Sello..." value={labelFilter} onFocus={() => setLabelFilter("")} onChange={(e) => setLabelFilter(e.target.value)} />
        <datalist id="labels-list">{labelsList.map((l: any) => <option key={l} value={l} />)}</datalist>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={styles.select}>
          <option value="priceDesc">Mayor precio</option><option value="priceAsc">Menor precio</option><option value="artistAsc">A-Z</option><option value="yearDesc">Más reciente</option>
        </select>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className={styles.select}>
          <option value="all">Ver Colección</option><option value="top10">Top 10</option><option value="rarezas">Rarezas</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className={styles.dashboardRoot}>
      {mounted && document.getElementById("header-portal") ? createPortal(tabs, document.getElementById("header-portal")!) : null}

      {activeTab === "collection" ? (
        <>
          <div className={styles.homeChart}><InvestmentChart snapshots={snapshots} /></div>
          <div className={styles.kpiGrid}>
            <KPI label="Valor Total Colección" value={formatEuro(totalValue)} />
            <KPI label="Disco Más Caro" value={formatEuro(maxPrice)} subText={maxPriceItem ? `${maxPriceItem.record?.artist} - ${maxPriceItem.record?.title}` : ""} />
            <KPI label="Total Discos" value={`${records.length}`} />
          </div>

          <div className={styles.desktopFiltersOnly}>
            {FiltersContent}
          </div>

          <div className={styles.mobileAccordionOnly}>
            <button className={styles.accordionToggle}  onClick={() => setShowFiltersMobile(!showFiltersMobile)}>
              <span className={styles.toggleLabel}>
                <IconFilter className={styles.btnIcon} /> {showFiltersMobile ? "Ocultar Filtros" : "Filtros y Búsqueda"}
              </span>
              {showFiltersMobile ? <IconChevronUp className={styles.toggleIcon} /> : <IconChevronDown className={styles.toggleIcon} />}
            </button>
            {showFiltersMobile && FiltersContent}
          </div>

          <h2 className={styles.sectionTitle}>
            <div className={styles.titleText}>{sectionTitle()} <span className={styles.recordCountBadge}>{displayData.length}</span></div>
            <div className={styles.filteredValue}>Total selección: <span>{formatEuro(filteredTotalValue)}</span></div>
          </h2>
          <div className={styles.grid}>
            {displayData.map((item: any) => (
              <a key={item.release_id} href={`/release/${item.release_id}`} className={styles.card}>
                <div className={styles.coverWrapper}>
                  {item.record?.cover_image ? (
                    <img src={item.record.cover_image} alt="" className={styles.coverImg} />
                  ) : (
                    <IconVinyl className={styles.coverPlaceholderIcon} />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.recordArtist}>{item.record?.artist}</div>
                  <div className={styles.recordTitle}>{item.record?.title}</div>
                  <div className={styles.recordPrice}>{formatEuro(item.price)}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      ) : activeTab === "analytics" ? (
        <AnalyticsView latestPrices={latestPrices} records={records} />
      ) : (
        <RandomView records={records} latestPrices={latestPrices} />
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