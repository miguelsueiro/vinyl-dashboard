# Vinyl Dashboard — Revisión UX (23/09/2026)

Revisión hecha sobre el código (no con usuarios). Severidad: **Alta** rompe una tarea o da un dato erróneo · **Media** fricción · **Baja** pulido.

**Estado a 25/09/2026** — 41 hallazgos: 23 hechos (tachados), 3 a medias, 15 sin tocar. Lo tachado está comprobado contra el código, no dado por hecho. Las fases de la hoja de ruta, al final.

## Top 5
1. Conservar el contexto al navegar (pestaña y filtros en la URL).
2. Separar géneros y estilos en valores individuales (hoy se listan combinaciones crudas de Discogs).
3. Subir el precio en la ficha de disco, junto a la portada; historial como gráfico.
4. Explicar el semáforo de fiabilidad y la tendencia (leyenda, delta, fecha de última sync).
5. Carpetas utilizables en táctil y teclado; contador en vivo al definir reglas.

## Hallazgos por área

### Navegación y cabecera
- [Alta] ~~`app/ui.tsx` solo lee `genre`, `style`, `year`, `label` de la URL; la ficha envía también `search`, `format`, `condition`, `sort`, `view` y se pierden al volver. → Leer los 9 params al iniciar y sincronizar la URL con `router.replace`.~~ **Hecho**: con la History API nativa, no `router.replace`: la portada es dinámica y un replace repetiría la consulta en cada tecla.
- [Alta] ~~Pestañas en `useState`: recargar/compartir/volver siempre lleva a Colección. → Pestaña en la URL (`?tab=` o rutas).~~ **Hecho**: falta pasar la carpeta concreta a la ficha.
- [Media] ~~Tarjetas con `<a href>` en vez de `Link`: recarga completa + loader en cada ficha. → `Link`; loader solo en primera carga.~~ **Hecho**.
- [Media] Cabecera fija con 40px de padding (~110px siempre ocupados). → Compactar al hacer scroll.
- [Media] ~~Nombres e idiomas mezclados (Record Collection / Vinyl Intelligence; Insights, Randomize, Smart Folders).~~ **Hecho** a medias por decisión: un solo nombre, Record Collection, y el encabezado de carpetas ya dice Carpetas como su pestaña. Insights y Randomize se quedan en inglés.
- [Media] ~~Hamburguesa sin `aria-label`/`aria-expanded`, sin Escape ni gestión de foco.~~ **Hecho**.
- [Baja] Restauración de scroll con una sola clave y escritura en cada evento de scroll. → Clave por pestaña, throttle.

### Colección (portada)
- [Alta] ~~Desplegables de género/estilo con cadenas completas ("House, Techno"). → Partir por coma, deduplicar, filtrar por token (también en Carpetas).~~ **Hecho**: el separador real no era la coma: hay un género que se llama "Folk, World, & Country".
- [Alta] ~~Sin estado vacío cuando los filtros no devuelven nada. → Mensaje + "Quitar filtros".~~ **Hecho**.
- [Media] ~~Gráfico (400px) antes que los KPIs. → KPIs arriba.~~ **Hecho**.
- [Media] ~~Placeholder como etiqueta en selects; sin chips de filtros activos ni contador en móvil.~~ **Hecho**: cada filtro tiene su etiqueta y los chips van fuera del acordeón, que es donde se ven en móvil.
- [Media] "Ver Colección / Top 10 / Rarezas" como select entre filtros. → Control segmentado junto al título.
- [Media] ~~Tendencia: flecha junto al precio anterior sin delta. → "+3,20 €" / "+8 %".~~ **Hecho**.
- [Media] ~~Año como lista; en Carpetas es rango. → Rango en ambos.~~ **Hecho**: los enlaces con `?year=` siguen valiendo.
- [Media] ~~Unas 1.330 tarjetas a la vez sin `loading="lazy"`. → Lazy, `next/image`, paginación/virtualización.~~ **Hecho**: lazy y tandas de 60; `next/image` y virtualización, pendientes.
- [Baja] Autocompletado solo artistas; la búsqueda no cubre sello.
- [Baja] "Limpiar" resetea también orden y vista y está siempre visible.
- [Baja] "Total Discos" cuenta `records` y el badge cuenta discos con precio; valor total del snapshot vs "Total selección" de precios actuales.

### Ficha de disco (`app/release/[id]/page.tsx`)
- [Alta] ~~Precio después de tracklist, créditos y notas. → Precio, tendencia y fiabilidad en la columna de info.~~ **Hecho**.
- [Media] Historial como lista. → Gráfico de línea; lista plegable.
- [Media] ~~Sin enlace de streaming, el formulario aparece abierto. → Botón "Añadir enlace".~~ **Hecho**.
- [Media] ~~`posicion`/`total` calculados pero no mostrados; flechas sin `aria-label` ni atajos. → "12 de 340", teclas ← →.~~ **Hecho**.
- [Media] Fallo de Discogs silencioso. → Aviso con reintento.
- [Baja] ~~Título de pestaña genérico. → `generateMetadata` "Artista – Título".~~ **Hecho**: sale del catálogo cacheado, así que no añade ninguna consulta.
- [Baja] Estilo no aparece como etiqueta; formatos no clicables.

### Insights (`app/analytics.tsx`)
- [Media] ~~"Rarezas" (≥40 € y 0 en venta) vs "Índice de Rareza" (precio/copias): dos definiciones. → Una.~~ **Hecho**: puntuación ≥ 80; entraron 11 discos y no salió ninguno.
- [Media] ~~"Score: 12.4" opaco. → "0 copias · 85 €" o escala 1–5.~~ **Hecho**.
- [Media] ~~Dos gráficos de estilos con denominadores distintos + donut de 7 colores. → Fusionar en barras horizontales.~~ **Hecho**: además contaban solo el primer estilo de cada disco, y 890 de 1.330 tienen varios.
- [Media] ~~Gráficos no navegables. → Clic → Colección filtrada.~~ **Hecho**: en estilos y en tramos de precio. El scatter, no.
- [Baja] Scatter aplastado por extremos. → Escala log, clic → ficha.
- [Baja] Variaciones sin fecha de sync ni límite.

### Insights — hallazgo nuevo (25/09/2026)
- [Media] Los tres gráficos no se pintan al entrar: quedan en blanco hasta que se hace scroll o se cambia el tamaño de la ventana. Es de `ResponsiveContainer`, que mide 0 en el primer render. Afecta también al histograma y al scatter, que no se han tocado.

### Randomize (`app/random-view.tsx`)
- [Alta] ~~Muestra de 40 (15 en móvil) fijada al montar; "Probar de nuevo" nunca sale de ella. → Re-muestrear en cada tirada.~~ **Hecho**.
- [Media] ~~Gira solo al entrar (3s), ignora `prefers-reduced-motion`.~~ **Hecho**.
- [Media] Resultado sin acciones. → "Escuchar", "Ver ficha", filtro opcional. **A medias**: el disco elegido enlaza a su ficha; no hay "Escuchar" ni filtro.

### Carpetas (`app/smart-folders.tsx`)
- [Alta] ~~Editar/borrar con `opacity: 0` hasta hover. → Siempre visibles o menú "⋯".~~ **Hecho**.
- [Alta] ~~Sin vista previa de coincidencias al definir reglas. → Contador en vivo en el modal.~~ **Hecho**.
- [Media] ~~Reglas sin formato ni estado; modelo de filtro distinto al de Colección. → Componente común + "Guardar como carpeta".~~ **Hecho**: salvo el componente común de filtros.
- [Media] Tarjetas `div` con onClick; modal sin `role="dialog"`, Escape, clic fuera ni foco. **A medias**: el modal ya tiene `role="dialog"`, Escape, clic fuera y foco; las tarjetas de carpeta siguen siendo `div` con onClick.
- [Media] `alert()`/`confirm()` nativos. → Toasts + deshacer.
- [Media] Desde carpeta, flechas y "Volver" ignoran la carpeta. → Pasar id de carpeta en la URL.
- [Baja] Emoji 📁 en vez de `IconFolder`; tarjetas sin punto de fiabilidad. **A medias**: las tarjetas ya llevan el punto, al compartir `RecordCard`; el emoji sigue.

## Transversales
- ~~Contraste: blanco al 30–40 % sobre #090909 = 2,6–3,7:1 (< 4,5 AA). → Mínimo 60 %.~~ **Hecho**.
- ~~Textos de 10–11px. → Mínimo 12px.~~ **Hecho**.
- Semáforo solo por color. → Forma/letra + leyenda. **A medias**: hay leyenda bajo el título, pero el punto se sigue distinguiendo solo por color.
- ~~Sin `:focus-visible`. → Anillo de foco global.~~ **Hecho**.
- Estados: ~~loader a pantalla completa en cada navegación~~; ~~vacíos solo en Carpetas/Variaciones~~; errores con `alert()`; ~~ninguna fecha de última sincronización visible~~. **A medias**: quedan los `alert()`.
- Consistencia: ~~tarjeta duplicada (extraer `RecordCard`)~~, iconos mixtos, ~~colores hardcodeados (→ tokens en `:root`)~~, ~~euros con 0/2 decimales~~, ~~"discos/álbumes/unidades"~~. **A medias**: quedan los iconos mixtos.
- Responsive: títulos de 11px en grid móvil; `<datalist>` flojo en iOS; coverflow con setState por frame.
- ~~Rendimiento: portada `force-dynamic` descarga todo en cada visita; cada ficha descarga toda la colección para anterior/siguiente.~~ **Hecho**: lectura única cacheada que comparten las dos páginas.

## Hoja de ruta

### Fase 1 — Quick wins
- [x] Leer todos los params de URL al volver a la portada
- [x] Partir géneros y estilos por coma (ver nota: el problema real era otro)
- [x] Re-muestrear en Randomize y no girar al entrar
- [x] Estado vacío en el grid de Colección
- [x] Acciones de carpeta visibles; Escape y clic fuera cierran el modal
- [x] Texto secundario al 60 % y 12px mín.; `:focus-visible` global
- [x] `aria-label` en hamburguesa, flechas y botones de icono
- [x] `loading="lazy"` en portadas
- [x] "12 de 340" en la ficha y atajos ← →

### Fase 2 — Mejoras medias
- [x] Pestañas en la URL (contexto de carpeta en la ficha, pendiente)
- [x] `Link` en vez de `<a>`; loader solo en primera carga, esqueletos después
- [x] Ficha: precio junto a la portada (historial como gráfico, pendiente)
- [x] Tendencia con delta y leyenda del semáforo
- [x] Fecha de última sincronización junto al valor total
- [x] KPIs por encima del gráfico
- [x] Chips de filtros y etiquetas visibles (control segmentado, pendiente)
- [x] Contador en vivo en carpetas (toasts en lugar de `alert()`, pendiente)
- [x] Una sola definición de rareza

### Fase 3 — Estructural
- [x] Tokens de color y `RecordCard` (FilterBar, Modal, Toast, EmptyState: pendientes)
- [x] Modelo de filtros único para Colección y Carpetas, con "Guardar como carpeta"
- [x] Insights navegable; fusionar gráficos de estilos (scatter con escala log, pendiente)
- [x] Carga paginada y catálogo cacheado; la ficha ya no relee la colección (virtualización y filtrado en servidor, pendientes)
- [x] Unificar idioma y nombre (acento de color propio, pendiente)
