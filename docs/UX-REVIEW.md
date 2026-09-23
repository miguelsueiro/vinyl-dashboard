# Vinyl Dashboard — Revisión UX (23/09/2026)

Revisión hecha sobre el código (no con usuarios). Severidad: **Alta** rompe una tarea o da un dato erróneo · **Media** fricción · **Baja** pulido.

## Top 5
1. Conservar el contexto al navegar (pestaña y filtros en la URL).
2. Separar géneros y estilos en valores individuales (hoy se listan combinaciones crudas de Discogs).
3. Subir el precio en la ficha de disco, junto a la portada; historial como gráfico.
4. Explicar el semáforo de fiabilidad y la tendencia (leyenda, delta, fecha de última sync).
5. Carpetas utilizables en táctil y teclado; contador en vivo al definir reglas.

## Hallazgos por área

### Navegación y cabecera
- [Alta] `app/ui.tsx` solo lee `genre`, `style`, `year`, `label` de la URL; la ficha envía también `search`, `format`, `condition`, `sort`, `view` y se pierden al volver. → Leer los 9 params al iniciar y sincronizar la URL con `router.replace`.
- [Alta] Pestañas en `useState`: recargar/compartir/volver siempre lleva a Colección. → Pestaña en la URL (`?tab=` o rutas).
- [Media] Tarjetas con `<a href>` en vez de `Link`: recarga completa + loader en cada ficha. → `Link`; loader solo en primera carga.
- [Media] Cabecera fija con 40px de padding (~110px siempre ocupados). → Compactar al hacer scroll.
- [Media] Nombres e idiomas mezclados (Record Collection / Vinyl Intelligence; Insights, Randomize, Smart Folders). → Un nombre y español: Colección, Carpetas, Análisis, Aleatorio.
- [Media] Hamburguesa sin `aria-label`/`aria-expanded`, sin Escape ni gestión de foco.
- [Baja] Restauración de scroll con una sola clave y escritura en cada evento de scroll. → Clave por pestaña, throttle.

### Colección (portada)
- [Alta] Desplegables de género/estilo con cadenas completas ("House, Techno"). → Partir por coma, deduplicar, filtrar por token (también en Carpetas).
- [Alta] Sin estado vacío cuando los filtros no devuelven nada. → Mensaje + "Quitar filtros".
- [Media] Gráfico (400px) antes que los KPIs. → KPIs arriba.
- [Media] Placeholder como etiqueta en selects; sin chips de filtros activos ni contador en móvil.
- [Media] "Ver Colección / Top 10 / Rarezas" como select entre filtros. → Control segmentado junto al título.
- [Media] Tendencia: flecha junto al precio anterior sin delta. → "+3,20 €" / "+8 %".
- [Media] Año como lista; en Carpetas es rango. → Rango en ambos.
- [Media] ~1.330 tarjetas a la vez sin `loading="lazy"`. → Lazy, `next/image`, paginación/virtualización.
- [Baja] Autocompletado solo artistas; la búsqueda no cubre sello.
- [Baja] "Limpiar" resetea también orden y vista y está siempre visible.
- [Baja] "Total Discos" cuenta `records` y el badge cuenta discos con precio; valor total del snapshot vs "Total selección" de precios actuales.

### Ficha de disco (`app/release/[id]/page.tsx`)
- [Alta] Precio después de tracklist, créditos y notas. → Precio, tendencia y fiabilidad en la columna de info.
- [Media] Historial como lista. → Gráfico de línea; lista plegable.
- [Media] Sin enlace de streaming, el formulario aparece abierto. → Botón "Añadir enlace".
- [Media] `posicion`/`total` calculados pero no mostrados; flechas sin `aria-label` ni atajos. → "12 de 340", teclas ← →.
- [Media] Fallo de Discogs silencioso. → Aviso con reintento.
- [Baja] Título de pestaña genérico. → `generateMetadata` "Artista – Título".
- [Baja] Estilo no aparece como etiqueta; formatos no clicables.

### Insights (`app/analytics.tsx`)
- [Media] "Rarezas" (≥40 € y 0 en venta) vs "Índice de Rareza" (precio/copias): dos definiciones. → Una.
- [Media] "Score: 12.4" opaco. → "0 copias · 85 €" o escala 1–5.
- [Media] Dos gráficos de estilos con denominadores distintos + donut de 7 colores. → Fusionar en barras horizontales.
- [Media] Gráficos no navegables. → Clic → Colección filtrada.
- [Baja] Scatter aplastado por extremos. → Escala log, clic → ficha.
- [Baja] Variaciones sin fecha de sync ni límite.

### Randomize (`app/random-view.tsx`)
- [Alta] Muestra de 40 (15 en móvil) fijada al montar; "Probar de nuevo" nunca sale de ella. → Re-muestrear en cada tirada.
- [Media] Gira solo al entrar (3s), ignora `prefers-reduced-motion`.
- [Media] Resultado sin acciones. → "Escuchar", "Ver ficha", filtro opcional.

### Carpetas (`app/smart-folders.tsx`)
- [Alta] Editar/borrar con `opacity: 0` hasta hover. → Siempre visibles o menú "⋯".
- [Alta] Sin vista previa de coincidencias al definir reglas. → Contador en vivo en el modal.
- [Media] Reglas sin formato ni estado; modelo de filtro distinto al de Colección. → Componente común + "Guardar como carpeta".
- [Media] Tarjetas `div` con onClick; modal sin `role="dialog"`, Escape, clic fuera ni foco.
- [Media] `alert()`/`confirm()` nativos. → Toasts + deshacer.
- [Media] Desde carpeta, flechas y "Volver" ignoran la carpeta. → Pasar id de carpeta en la URL.
- [Baja] Emoji 📁 en vez de `IconFolder`; tarjetas sin punto de fiabilidad.

## Transversales
- Contraste: blanco al 30–40 % sobre #090909 = 2,6–3,7:1 (< 4,5 AA). → Mínimo 60 %.
- Textos de 10–11px. → Mínimo 12px.
- Semáforo solo por color. → Forma/letra + leyenda.
- Sin `:focus-visible`. → Anillo de foco global.
- Estados: loader a pantalla completa en cada navegación; vacíos solo en Carpetas/Variaciones; errores con `alert()`; ninguna fecha de última sincronización visible.
- Consistencia: tarjeta duplicada (extraer `RecordCard`), iconos mixtos, colores hardcodeados (→ tokens en `:root`), euros con 0/2 decimales, "discos/álbumes/unidades".
- Responsive: títulos de 11px en grid móvil; `<datalist>` flojo en iOS; coverflow con setState por frame.
- Rendimiento: portada `force-dynamic` descarga todo en cada visita; cada ficha descarga toda la colección para anterior/siguiente.

## Hoja de ruta

### Fase 1 — Quick wins
- [x] Leer todos los params de URL al volver a la portada
- [x] Partir géneros y estilos por coma (ver nota: el problema real era otro)
- [x] Re-muestrear en Randomize y no girar al entrar
- [x] Estado vacío en el grid de Colección
- [ ] Acciones de carpeta visibles; Escape y clic fuera cierran el modal
- [ ] Texto secundario al 60 % y 12px mín.; `:focus-visible` global
- [ ] `aria-label` en hamburguesa, flechas y botones de icono
- [ ] `loading="lazy"` en portadas
- [ ] "12 de 340" en la ficha y atajos ← →

### Fase 2 — Mejoras medias
- [ ] Pestañas en la URL y contexto de carpeta en la ficha
- [ ] `Link` en vez de `<a>`; loader solo en primera carga, esqueletos después
- [ ] Ficha: precio junto a la portada; historial como gráfico
- [ ] Tendencia con delta y leyenda del semáforo
- [ ] Fecha de última sincronización junto al valor total
- [ ] KPIs por encima del gráfico
- [ ] Chips de filtros, etiquetas visibles, control segmentado
- [ ] Contador en vivo en carpetas; toasts en lugar de `alert()`
- [ ] Una sola definición de rareza

### Fase 3 — Estructural
- [ ] Sistema de diseño mínimo: tokens, `RecordCard`, `FilterBar`, `Modal`, `Toast`, `EmptyState`
- [ ] Modelo de filtros único para Colección y Carpetas
- [ ] Insights navegable; fusionar gráficos de estilos
- [ ] Carga paginada / en servidor; navegación sin descargar toda la colección
- [ ] Unificar idioma y nombre; valorar acento de color propio
