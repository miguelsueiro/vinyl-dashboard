"use client";

import { useMemo, useState, Suspense, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import RecordCard from "@/components/RecordCard";
import { useSearchParams } from "next/navigation";
import styles from "./dashboard.module.css";

import InvestmentChart from "./investment-chart";
import AnalyticsView from "./analytics";
import RandomView from "./random-view";
import SmartFoldersView from "./smart-folders";
import {
  IconSearch, IconFilter, IconChevronDown, IconChevronUp, IconClose, IconFolder
} from "@/components/icons";
import { createSmartFolder } from "./actions";
import { getFiabilidad, resumirFiabilidad } from "@/lib/confidence";
import { esRaro } from "@/lib/rareza";
import type {
  Disco, PrecioActual, Snapshot, CarpetaInteligente, DiscoConPrecio, Tendencia,
  ReglasCarpeta,
} from "@/lib/types";
import type { Frescura } from "@/lib/fechas";
import {
  cumpleFiltros, ordenarColeccion, redondear, tokensUnicos,
  filtrosDesdeParams, ordenDesdeParams, vistaDesdeParams, pestanaDesdeParams,
  construirQuery, filtros, etiquetaRango, OPCIONES_FORMATO, OPCIONES_ESTADO, ESTADO_SIN_DATO,
  POR_PAGINA, verDesdeParams,
  FILTROS_VACIOS, ORDEN_POR_DEFECTO, VISTA_POR_DEFECTO,
  type FiltrosColeccion, type OrdenColeccion, type VistaColeccion,
  type PestanaDashboard,
} from "@/lib/collection";

interface PropsDashboard {
  latestPrices: PrecioActual[];
  records: Disco[];
  snapshots: Snapshot[];
  initialSmartFolders: CarpetaInteligente[];
  /** Cuándo terminó la última sincronización. Se calcula en el servidor. */
  ultimaSync: Frescura | null;
}

function DashboardInner({ latestPrices, records, snapshots, initialSmartFolders, ultimaSync }: PropsDashboard) {
  const searchParams = useSearchParams();

  // El portal necesita saber si ya estamos en el navegador. Antes se hacía con
  // un setMounted(true) dentro de un efecto, que provoca un render en cascada.
  // useSyncExternalStore es el idioma para esto: devuelve false en el servidor
  // y true en cliente, sin estado intermedio.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // 🔄 RESTAURACIÓN DE SCROLL
  useEffect(() => {
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

  // La pestaña se lee de la URL en cada render en lugar de guardarse en estado.
  // Así recargar o compartir el enlace abre la sección correcta, y el botón
  // atrás del navegador se mueve entre secciones sin código extra: Next
  // actualiza useSearchParams cuando cambia el historial.
  const activeTab: PestanaDashboard = pestanaDesdeParams(searchParams);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [search, setSearch] = useState(filtrosIniciales.search);
  const [genre, setGenre] = useState(filtrosIniciales.genre);
  const [styleFilter, setStyleFilter] = useState(filtrosIniciales.style);
  const [yearMin, setYearMin] = useState(filtrosIniciales.yearMin);
  const [yearMax, setYearMax] = useState(filtrosIniciales.yearMax);
  // Precio: sin control propio en la barra de filtros, se pone al pinchar un
  // tramo del histograma de Insights y se quita desde su chip.
  const [priceMin, setPriceMin] = useState(filtrosIniciales.priceMin);
  const [priceMax, setPriceMax] = useState(filtrosIniciales.priceMax);
  const [labelFilter, setLabelFilter] = useState(filtrosIniciales.label);
  const [formatFilter, setFormatFilter] = useState(filtrosIniciales.format);
  const [conditionFilter, setConditionFilter] = useState(filtrosIniciales.condition);
  const [viewMode, setViewMode] = useState<VistaColeccion>(() => vistaDesdeParams(searchParams));
  const [sortBy, setSortBy] = useState<OrdenColeccion>(() => ordenDesdeParams(searchParams));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paginado, setPaginado] = useState(() => ({
    clave: construirQuery(filtrosDesdeParams(searchParams), ordenDesdeParams(searchParams), vistaDesdeParams(searchParams)).toString(),
    visibles: verDesdeParams(searchParams),
  }));


  // Las carpetas viven aquí y no dentro de la sección de Carpetas porque ahora
  // también se crean desde la portada: si el estado estuviera allí, la carpeta
  // recién guardada no aparecería hasta recargar.
  const [folders, setFolders] = useState<CarpetaInteligente[]>(initialSmartFolders || []);
  const [guardando, setGuardando] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState<string | null>(null);
  const [avisoCarpeta, setAvisoCarpeta] = useState("");

  const recordMap = useMemo(() => new Map<number, Disco>(records.map((r) => [Number(r.discogs_release_id), r])), [records]);
  
  // 📈 CÁLCULO DE TENDENCIAS
  // El precio anterior lo guarda la sincronización nocturna en la propia fila,
  // así que aquí no hay que cargar ni recorrer histórico.
  const enriched: DiscoConPrecio[] = useMemo(() => latestPrices.map((p) => {
    const record = recordMap.get(Number(p.release_id));
    const price = redondear(p.median_price ?? p.lowest_price);

    // Sin previous_price (fila nueva, o columna recién creada) no hay con qué
    // comparar: el anterior es el actual y la flecha queda "estable".
    const prevPrice = p.previous_price != null ? redondear(p.previous_price) : price;
    let trend: Tendencia = "stable";
    if (price > prevPrice) trend = "up";
    else if (price < prevPrice) trend = "down";

    const confidence = getFiabilidad(p.num_for_sale, record?.condition_vinyl);

    return { ...p, record, price, prevPrice, trend, confidence, isRare: esRaro(price, p.num_for_sale) };
  }), [latestPrices, recordMap]);

  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const totalValue = lastSnapshot?.total_value ?? enriched.reduce((sum, item) => sum + item.price, 0);
  const confidenceSummary = useMemo(() => resumirFiabilidad(enriched), [enriched]);
  const sortedByPriceItems = [...enriched].sort((a, b) => b.price - a.price);
  const maxPriceItem = sortedByPriceItems.length > 0 ? sortedByPriceItems[0] : null;
  const maxPrice = maxPriceItem ? maxPriceItem.price : 0;
  
  const sortedData = useMemo(() => ordenarColeccion(enriched, sortBy), [enriched, sortBy]);
  
  const artists = useMemo(() => Array.from(new Set(records.map((r) => r.artist).filter((a): a is string => Boolean(a)))).sort(), [records]);
  // Multivalor: un disco puede ser "Hardcore, Punk, Noise" y debe aparecer bajo
  // los tres, no solo bajo el primero.
  const genres = useMemo(() => tokensUnicos(records, "genre"), [records]);
  const stylesList = useMemo(() => tokensUnicos(records, "style"), [records]);
  const years = useMemo(() => Array.from(new Set(records.map((r) => String(r.year)).filter((y) => y && y !== "null" && y !== "0"))).sort(), [records]);
  const labelsList = useMemo(() => Array.from(new Set(records.map((r) => r.label).filter((l): l is string => Boolean(l)))).sort(), [records]);

  // filtros() rellena con los valores vacíos los campos que la portada no
  // ofrece (artista, país, precio): el modelo es el mismo que el de Carpetas,
  // aunque aquí no haya un control para cada cosa.
  const filters: FiltrosColeccion = useMemo(() => filtros({
    search, genre, style: styleFilter, label: labelFilter,
    format: formatFilter, condition: conditionFilter, yearMin, yearMax, priceMin, priceMax,
  }), [search, genre, styleFilter, labelFilter, formatFilter, conditionFilter, yearMin, yearMax, priceMin, priceMax]);

  // Un gráfico de Insights que lleva a los discos que lo forman. Sustituye los
  // filtros en lugar de sumarse a ellos: venir de otra sección y encontrarse
  // el resultado recortado por algo que se dejó puesto antes despista más que
  // ayuda.
  const verEnColeccion = (parciales: Partial<FiltrosColeccion>) => {
    const nuevos = filtros(parciales);
    setSearch(nuevos.search);
    setGenre(nuevos.genre);
    setStyleFilter(nuevos.style);
    setLabelFilter(nuevos.label);
    setFormatFilter(nuevos.format);
    setConditionFilter(nuevos.condition);
    setYearMin(nuevos.yearMin);
    setYearMax(nuevos.yearMax);
    setPriceMin(nuevos.priceMin);
    setPriceMax(nuevos.priceMax);
    setViewMode("all");

    const qs = construirQuery(nuevos, sortBy, "all", "collection").toString();
    window.history.pushState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    window.scrollTo({ top: 0 });
  };

  // Cuántas tarjetas se pintan. La colección son 1.330: pintarlas todas de
  // golpe mandaba 3,1 MB de HTML en cada visita, la mayor parte de discos que
  // nadie llega a ver. Se filtra y se suma sobre la lista completa, que eso sí
  // hace falta; solo se recorta lo que se dibuja.
  //
  // Cambiar de filtro, de orden o de vista empieza otra lista y vuelve a la
  // primera tanda. Va atado a la lista en lugar de reiniciarse desde un efecto
  // porque un setState dentro de un efecto encadena un render de más.
  // La clave la escribe construirQuery, que ya normaliza el orden y los
  // valores por defecto: dos formas de pedir lo mismo dan la misma cadena.
  // Se compara con la de la URL de llegada, para que un enlace con ?ver=180
  // aparezca con sus 180 tarjetas y no recortado a la primera tanda.
  const claveLista = construirQuery(filters, sortBy, viewMode).toString();
  const visibles = paginado.clave === claveLista ? paginado.visibles : POR_PAGINA;
  const verMas = () => setPaginado({ clave: claveLista, visibles: visibles + POR_PAGINA });

  const cambiarPestana = (destino: PestanaDashboard) => {
    setIsMenuOpen(false);
    if (destino === activeTab) return;
    const qs = construirQuery(filters, sortBy, viewMode, destino).toString();
    // pushState y no replaceState: cambiar de sección es navegación
    // deliberada, así que el botón atrás del navegador debe deshacerla.
    window.history.pushState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };

  // La URL refleja el estado, para que compartirla —o volver desde una ficha—
  // devuelva exactamente lo que había en pantalla.
  //
  // Se usa la History API nativa y no router.replace a propósito: la portada es
  // force-dynamic, así que un replace volvería a pedir los 1.330 discos al
  // servidor en cada tecla de la búsqueda. Next integra pushState/replaceState
  // con useSearchParams sin recargar la página.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // La sección se lee de la URL en el momento de ejecutarse, no de activeTab:
    // al saltar de un gráfico de Insights a la Colección cambian la sección y
    // los filtros a la vez, y en ese render activeTab todavía dice "analytics".
    // Con el valor viejo, este efecto devolvía al usuario a Insights.
    const pestanaActual = pestanaDesdeParams(new URLSearchParams(window.location.search));
    const qs = construirQuery(filters, sortBy, viewMode, pestanaActual, visibles).toString();
    const destino = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (destino !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", destino);
    }
  }, [filters, sortBy, viewMode, activeTab, visibles]);

  // Antes se recalculaba en cada render —cada tecla de la búsqueda recorría los
  // 1.331 discos comparando siete campos de texto—, ahora solo cuando cambia algo.
  const filtered = useMemo(
    () => sortedData.filter((item) => cumpleFiltros(item, filters)),
    [sortedData, filters]
  );

  let displayData = filtered;
  if (viewMode === "top10") displayData = filtered.slice(0, 10);
  else if (viewMode === "rarezas") displayData = filtered.filter((i) => i.isRare);

  const mostrados = displayData.slice(0, visibles);

  const sectionTitle = () => {
    if (viewMode === "top10") return "Tus 10 más cotizados";
    if (viewMode === "rarezas") return "Joyas y Rarezas";
    return "Tus Joyas Analógicas";
  };

  const formatEuro = (val: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);
  const filteredTotalValue = displayData.reduce((sum, item) => sum + item.price, 0);
  const clearFilters = () => {
    setSearch(""); setGenre(""); setStyleFilter(""); setYearMin(""); setYearMax(""); setPriceMin(""); setPriceMax(""); setLabelFilter(""); setFormatFilter("all"); setConditionFilter(""); setSortBy("priceDesc"); setViewMode("all");
  };

  const AvisoCarpeta = avisoCarpeta ? (
    <p className={styles.avisoCarpeta} role="status">{avisoCarpeta}</p>
  ) : null;

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
        <button className={`${styles.tabBtn} ${activeTab === "collection" ? styles.active : ""}`} onClick={() => cambiarPestana("collection")}>Colección</button>
        <button className={`${styles.tabBtn} ${activeTab === "folders" ? styles.active : ""}`} onClick={() => cambiarPestana("folders")}>Carpetas</button>
        <button className={`${styles.tabBtn} ${activeTab === "analytics" ? styles.active : ""}`} onClick={() => cambiarPestana("analytics")}>Insights</button>
        <button className={`${styles.tabBtn} ${activeTab === "random" ? styles.active : ""}`} onClick={() => cambiarPestana("random")}>Randomize</button>
      </div>
    </div>
  );

  // Lo que hay filtrado ahora mismo, para enseñarlo como chips. Antes no se
  // veía: los desplegables usan el texto de ejemplo como etiqueta, así que al
  // elegir un valor desaparecía el nombre del filtro.
  const chipsActivos: Array<{ id: string; etiqueta: string; valor: string; quitar: () => void }> = [];
  if (search.trim()) chipsActivos.push({ id: "search", etiqueta: "Búsqueda", valor: search, quitar: () => setSearch("") });
  if (formatFilter !== "all") chipsActivos.push({ id: "format", etiqueta: "Formato", valor: formatFilter, quitar: () => setFormatFilter("all") });
  if (genre) chipsActivos.push({ id: "genre", etiqueta: "Género", valor: genre, quitar: () => setGenre("") });
  if (styleFilter) chipsActivos.push({ id: "style", etiqueta: "Estilo", valor: styleFilter, quitar: () => setStyleFilter("") });
  if (yearMin || yearMax) {
    chipsActivos.push({
      id: "year",
      etiqueta: "Año",
      valor: etiquetaRango(yearMin, yearMax),
      quitar: () => { setYearMin(""); setYearMax(""); setPriceMin(""); setPriceMax(""); },
    });
  }
  if (priceMin || priceMax) {
    chipsActivos.push({
      id: "price",
      etiqueta: "Precio",
      valor: `${etiquetaRango(priceMin, priceMax)} €`,
      quitar: () => { setPriceMin(""); setPriceMax(""); },
    });
  }
  if (labelFilter) chipsActivos.push({ id: "label", etiqueta: "Sello", valor: labelFilter, quitar: () => setLabelFilter("") });
  if (conditionFilter) chipsActivos.push({
    id: "condition",
    etiqueta: "Estado",
    valor: conditionFilter === ESTADO_SIN_DATO ? "Sin datos en Discogs" : conditionFilter,
    quitar: () => setConditionFilter(""),
  });

  // Lo que hay filtrado, tal cual, listo para guardarse. Los filtros y las
  // reglas de una carpeta son el mismo modelo, así que no hay que traducir:
  // solo quitar lo que está vacío, que significa "sin regla".
  const reglasDeLosFiltros = (): ReglasCarpeta => ({
    ...(search.trim() && { search: search.trim() }),
    ...(genre && { genre }),
    ...(styleFilter && { style: styleFilter }),
    ...(labelFilter && { label: labelFilter }),
    ...(formatFilter !== "all" && { format: formatFilter }),
    ...(conditionFilter && { condition: conditionFilter }),
    ...(yearMin && { yearMin }),
    ...(yearMax && { yearMax }),
    ...(priceMin && { priceMin }),
    ...(priceMax && { priceMax }),
  });

  // El nombre que se propone: los propios filtros, en el orden en que se ven.
  const nombrePropuesto = () => chipsActivos.map((c) => c.valor).join(" · ").slice(0, 60);

  const guardarComoCarpeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = (nombreCarpeta || "").trim();
    if (!nombre || guardando) return;

    setGuardando(true);
    setAvisoCarpeta("");
    const res = await createSmartFolder(nombre, reglasDeLosFiltros());
    setGuardando(false);

    if (res.success && res.folder) {
      setFolders([...folders, res.folder as CarpetaInteligente]);
      setNombreCarpeta(null);
      setAvisoCarpeta(`Carpeta "${nombre}" creada con ${displayData.length} discos.`);
    } else {
      setAvisoCarpeta(`No se pudo crear: ${res.error}`);
    }
  };

  // Fuera de FiltersContent a propósito: en móvil los filtros van dentro de un
  // acordeón plegado, así que dentro no se verían justo cuando más falta hacen.
  const ChipsActivos = chipsActivos.length > 0 ? (
    <div className={styles.chipsRow} aria-label="Filtros aplicados">
      {chipsActivos.map((c) => (
        <button
          key={c.id}
          type="button"
          className={styles.chip}
          onClick={c.quitar}
          aria-label={`Quitar el filtro ${c.etiqueta}: ${c.valor}`}
        >
          <span className={styles.chipLabel}>{c.etiqueta}</span>
          <span className={styles.chipValue}>{c.valor}</span>
          <IconClose className={styles.chipIcon} />
        </button>
      ))}

      {/* Lo que se ve en pantalla ya es la definición de una carpeta; solo le
          falta un nombre. Antes había que ir a Carpetas y repetir los filtros
          a mano en el modal. */}
      {nombreCarpeta === null ? (
        <button type="button" className={styles.chipAccion} onClick={() => setNombreCarpeta(nombrePropuesto())}>
          <IconFolder className={styles.chipIcon} /> Guardar como carpeta
        </button>
      ) : (
        <form className={styles.guardarCarpeta} onSubmit={guardarComoCarpeta}>
          <input
            autoFocus
            value={nombreCarpeta}
            onChange={(e) => setNombreCarpeta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setNombreCarpeta(null); }}
            className={styles.guardarCarpetaInput}
            placeholder="Nombre de la carpeta"
            aria-label="Nombre de la carpeta"
            maxLength={80}
          />
          <button type="submit" className={styles.chipAccion} disabled={guardando || !nombreCarpeta.trim()}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={styles.chipAccion} onClick={() => setNombreCarpeta(null)}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  ) : null;

  const FiltersContent = (
    <div className={styles.filtersWrapper}>
      <div className={styles.searchRow}>
        <div className={styles.inputWrapper}>
          <IconSearch className={styles.inputIcon} />
          <input
            id="filtro-busqueda"
            placeholder="Buscar disco o artista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.inputSearch}
            list="home-artists-list"
            autoComplete="off"
            aria-label="Buscar disco o artista"
          />
          <datalist id="home-artists-list">
            {artists.map((a: string) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <button onClick={clearFilters} className={styles.clearFiltersBtn} disabled={chipsActivos.length === 0}>
          <IconClose className={styles.btnIcon} /> Limpiar
        </button>
      </div>

      <div className={styles.filterGroup}>
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-formato">Formato</label>
          <select id="f-formato" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className={styles.select}>
            <option value="all">Todos</option>
            {OPCIONES_FORMATO.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-genero">Género</label>
          <select id="f-genero" value={genre} onChange={(e) => setGenre(e.target.value)} className={styles.select}>
            <option value="">Todos</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-estilo">Estilo</label>
          <select id="f-estilo" value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)} className={styles.select}>
            <option value="">Todos</option>
            {stylesList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className={`${styles.filterField} ${styles.filterFieldAnio}`}>
          <label className={styles.filterLabel} htmlFor="f-anio-desde">Año</label>
          {/* Rango, como en Carpetas. Siguen siendo listas de los años que hay
              en la colección: escribir a mano permite pedir años inexistentes. */}
          <div className={styles.rangoAnios}>
            <select
              id="f-anio-desde"
              value={yearMin}
              onChange={(e) => setYearMin(e.target.value)}
              className={styles.select}
              aria-label="Año desde"
            >
              <option value="">Desde</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={yearMax}
              onChange={(e) => setYearMax(e.target.value)}
              className={styles.select}
              aria-label="Año hasta"
            >
              <option value="">Hasta</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-sello">Sello</label>
          <select id="f-sello" value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className={styles.select}>
            <option value="">Todos</option>
            {labelsList.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-estado">Estado</label>
          <select id="f-estado" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className={styles.select}>
            <option value="">Todos</option>
            {OPCIONES_ESTADO.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-orden">Ordenar por</label>
          <select id="f-orden" value={sortBy} onChange={(e) => setSortBy(e.target.value as OrdenColeccion)} className={styles.select}>
            <option value="priceDesc">Mayor precio</option>
            <option value="priceAsc">Menor precio</option>
            <option value="artistAsc">A-Z</option>
            <option value="yearDesc">Más reciente</option>
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="f-vista">Ver</label>
          <select id="f-vista" value={viewMode} onChange={(e) => setViewMode(e.target.value as VistaColeccion)} className={styles.select}>
            <option value="all">Toda la colección</option>
            <option value="top10">Top 10</option>
            <option value="rarezas">Rarezas</option>
          </select>
        </div>
      </div>
    </div>
  );

  // Para Carpetas e Insights, que no usan los filtros de Colección: basta con
  // arrastrar la sección para que "Volver" devuelva a donde estabas.
  const urlDiscoDeSeccion = (releaseId: string | number) => {
    const qs = construirQuery(FILTROS_VACIOS, ORDEN_POR_DEFECTO, VISTA_POR_DEFECTO, activeTab).toString();
    return `/release/${releaseId}${qs ? `?${qs}` : ""}`;
  };

  // Mismo constructor que usa la sincronización de la URL, para que lo que se
  // envía a la ficha y lo que se recupera al volver no puedan divergir.
  const getReleaseUrl = (releaseId: string | number) => {
    const qs = construirQuery(filters, sortBy, viewMode, activeTab, visibles).toString();
    return `/release/${releaseId}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={styles.dashboardRoot}>
      {mounted && document.getElementById("header-portal") ? createPortal(tabs, document.getElementById("header-portal")!) : null}

      {activeTab === "collection" ? (
        <>
          <div className={styles.kpiGrid}>
            <KPI
              label="Valor Total Colección"
              value={formatEuro(totalValue)}
              subText={confidenceSummary.discos > 0
                ? `${formatEuro(confidenceSummary.firme.valor)} sobre mercado contrastado`
                : ""}
              footer={ultimaSync ? (
                <span className={`${styles.syncStamp} ${ultimaSync.obsoleto ? styles.syncStale : ""}`}>
                  <i className={styles.syncDot} />
                  {ultimaSync.obsoleto ? "Sin actualizar desde" : "Actualizado"}
                  <time dateTime={ultimaSync.iso}>{ultimaSync.etiqueta}</time>
                </span>
              ) : undefined}
            />
            <KPI label="Disco Más Caro" value={formatEuro(maxPrice)} subText={maxPriceItem ? `${maxPriceItem.record?.artist} - ${maxPriceItem.record?.title}` : ""} />
            <KPI label="Total Discos" value={`${records.length}`} />
          </div>

          {/* El gráfico va DESPUÉS de los números: ocupa 400px de alto y
              empujaba el valor total y el disco más caro por debajo del pliegue. */}
          <div className={styles.homeChart}><InvestmentChart snapshots={snapshots} /></div>

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

          {ChipsActivos}
          {AvisoCarpeta}

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
                  ? "Las rarezas son los discos caros y con poca o ninguna copia a la venta. Prueba a quitar algún filtro."
                  : "Hay 1.330 discos en la colección, pero ninguno cumple lo que has pedido. Prueba a quitar algún filtro."}
              </p>
              <button onClick={clearFilters} className={styles.emptyGridBtn}>
                <IconClose className={styles.btnIcon} /> Quitar todos los filtros
              </button>
            </div>
          ) : (
          <>
          <div className={styles.confLegend}>
            <span className={styles.confLegendTitle}>El punto del precio:</span>
            <span className={styles.confLegendItem}>
              <i className={`${styles.confDot} ${styles.confFirme}`} />
              <b>Firme</b> — 5 copias o más a la venta
            </span>
            <span className={styles.confLegendItem}>
              <i className={`${styles.confDot} ${styles.confOrientativo}`} />
              <b>Orientativo</b> — pocas copias, o estado sin registrar
            </span>
            <span className={styles.confLegendItem}>
              <i className={`${styles.confDot} ${styles.confDudoso}`} />
              <b>Dudoso</b> — no lo vende nadie
            </span>
          </div>

          <div className={styles.grid}>
            {mostrados.map((item) => (
              <RecordCard key={item.release_id} item={item} href={getReleaseUrl(item.release_id)} />
            ))}
          </div>

          {mostrados.length < displayData.length && (
            <div className={styles.verMas}>
              <button
                type="button"
                className={styles.verMasBtn}
                onClick={verMas}
              >
                Ver más discos
              </button>
              <span className={styles.verMasCuenta}>
                {mostrados.length} de {displayData.length}
              </span>
            </div>
          )}
          </>
          )}
        </>
      ) : activeTab === "folders" ? (
        <SmartFoldersView records={records} enriched={enriched} folders={folders} setFolders={setFolders} urlDisco={urlDiscoDeSeccion} />
      ) : activeTab === "analytics" ? (
        <AnalyticsView enriched={enriched} urlDisco={urlDiscoDeSeccion} verEnColeccion={verEnColeccion} />
      ) : (
        <RandomView records={records} />
      )}
    </div>
  );
}

export default function ClientDashboard(props: PropsDashboard) {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#fff' }}>Cargando colección...</div>}>
      <DashboardInner {...props} />
    </Suspense>
  );
}

function KPI({ label, value, subText, footer }: {
  label: string;
  value: string;
  subText?: string;
  footer?: ReactNode;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {subText && <div className={styles.kpiSubText}>{subText}</div>}
      {footer}
    </div>
  );
}