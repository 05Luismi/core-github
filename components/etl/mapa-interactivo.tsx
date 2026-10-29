"use client"

import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { useSegundo } from "@/components/hud/reloj-hud"
import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { formatearEntero, formatearNumero } from "@/lib/etl/formato"
import {
  colorRampa,
  METRICAS,
  type Metrica,
  type ResumenCiudad,
} from "@/lib/etl/resumen-ciudades"

export type EstiloMapa = "satelite" | "oscuro"

const ESTILOS: Record<EstiloMapa, string> = { satelite: "satellite-v4", oscuro: "dataviz-v4-dark" }
const ZOOM_CIUDAD = 9
const MARGEN_VISTA = 48
const NARANJA = "#ff8a1f"
// Centro de la red de arcos: los datos «viajan» desde Madrid hacia cada ciudad.
const NODO_CENTRAL = "madrid"
const DURACION_PAQUETE_MS = 3200

export type Relleno = { top: number; right: number; bottom: number; left: number }

function limitesCiudades(): maplibregl.LngLatBoundsLike {
  const lons = CIUDADES.map((c) => c.longitud)
  const lats = CIUDADES.map((c) => c.latitud)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

function ampliar(r: Relleno, extra: number): Relleno {
  return { top: r.top + extra, right: r.right + extra, bottom: r.bottom + extra, left: r.left + extra }
}

/** Desplazamiento del centro para que quede en medio del hueco libre (sin padding persistente en la cámara). */
function desplazamiento(r: Relleno): [number, number] {
  return [(r.left - r.right) / 2, (r.top - r.bottom) / 2]
}

/** Punto de una curva de Bézier cuadrática entre `a` y `b`, arqueada hacia un lado. */
function puntoArco(a: Ciudad, b: Ciudad, t: number): [number, number] {
  const mx = (a.longitud + b.longitud) / 2
  const my = (a.latitud + b.latitud) / 2
  const cx = mx - (b.latitud - a.latitud) * 0.3
  const cy = my + (b.longitud - a.longitud) * 0.3
  const u = 1 - t
  return [u * u * a.longitud + 2 * u * t * cx + t * t * b.longitud, u * u * a.latitud + 2 * u * t * cy + t * t * b.latitud]
}

const CENTRAL = CIUDADES.find((c) => c.id === NODO_CENTRAL) ?? CIUDADES[0]
const DESTINOS = CIUDADES.filter((c) => c !== CENTRAL)

function geojsonArcos(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: DESTINOS.map((c) => ({
      type: "Feature",
      properties: { id: c.id },
      geometry: { type: "LineString", coordinates: Array.from({ length: 41 }, (_, i) => puntoArco(CENTRAL, c, i / 40)) },
    })),
  }
}

function geojsonPaquetes(ahora: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: DESTINOS.map((c, i) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: puntoArco(CENTRAL, c, (ahora / DURACION_PAQUETE_MS + i / DESTINOS.length) % 1) },
    })),
  }
}

/** Retícula de meridianos y paralelos cada 2° sobre la península. */
function geojsonReticula(): GeoJSON.FeatureCollection {
  const lineas: GeoJSON.Feature[] = []
  for (let lon = -14; lon <= 8; lon += 2)
    lineas.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lon, 33], [lon, 47]] } })
  for (let lat = 34; lat <= 46; lat += 2)
    lineas.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-14, lat], [8, lat]] } })
  return { type: "FeatureCollection", features: lineas }
}

/** Capas propias del HUD; se añaden de nuevo cada vez que cambia el estilo base. */
function anadirCapas(m: maplibregl.Map, clave: string) {
  if (!m.getSource("reticula")) m.addSource("reticula", { type: "geojson", data: geojsonReticula() })
  if (!m.getSource("arcos")) m.addSource("arcos", { type: "geojson", data: geojsonArcos() })
  if (!m.getSource("paquetes")) m.addSource("paquetes", { type: "geojson", data: geojsonPaquetes(0) })
  if (!m.getSource("terreno"))
    m.addSource("terreno", { type: "raster-dem", url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(clave)}`, tileSize: 256 })
  if (!m.getSource("sombreado"))
    m.addSource("sombreado", { type: "raster-dem", url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(clave)}`, tileSize: 256 })

  if (!m.getLayer("relieve"))
    m.addLayer({
      id: "relieve",
      type: "hillshade",
      source: "sombreado",
      layout: { visibility: "none" },
      paint: { "hillshade-shadow-color": "#0b1018", "hillshade-highlight-color": "#ffb36b", "hillshade-exaggeration": 0.6 },
    })
  if (!m.getLayer("reticula"))
    m.addLayer({ id: "reticula", type: "line", source: "reticula", paint: { "line-color": NARANJA, "line-opacity": 0.18, "line-width": 0.8, "line-dasharray": [2, 3] } })
  if (!m.getLayer("arcos-halo"))
    m.addLayer({ id: "arcos-halo", type: "line", source: "arcos", paint: { "line-color": NARANJA, "line-opacity": 0.25, "line-width": 6, "line-blur": 5 } })
  if (!m.getLayer("arcos"))
    m.addLayer({ id: "arcos", type: "line", source: "arcos", paint: { "line-color": NARANJA, "line-opacity": 0.85, "line-width": 1.2, "line-dasharray": [3, 2] } })
  if (!m.getLayer("paquetes-halo"))
    m.addLayer({ id: "paquetes-halo", type: "circle", source: "paquetes", paint: { "circle-color": NARANJA, "circle-radius": 9, "circle-opacity": 0.25, "circle-blur": 1 } })
  if (!m.getLayer("paquetes"))
    m.addLayer({ id: "paquetes", type: "circle", source: "paquetes", paint: { "circle-color": "#ffe1c2", "circle-radius": 2.6, "circle-stroke-color": NARANJA, "circle-stroke-width": 1.2 } })
}

function crear<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string) {
  const el = document.createElement(etiqueta)
  el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/** Contenido del popup construido con nodos de texto: nunca se interpreta HTML. */
function contenidoPopup(c: Ciudad, r: ResumenCiudad | undefined, activa: boolean): HTMLElement {
  const raiz = crear("div", "flex min-w-56 flex-col gap-2 text-xs")
  const objetivo = crear("span", "hud-etiqueta text-primary", activa ? "Objetivo fijado" : "Objetivo")
  const cabecera = crear("div", "flex items-baseline justify-between gap-3")
  cabecera.append(crear("strong", "text-base tracking-wider uppercase", c.nombre))
  if (r) cabecera.append(crear("span", "text-muted-foreground tabular-nums", `${formatearEntero(r.horas)} h válidas`))
  const coordenadas = crear("div", "grid grid-cols-2 gap-2 border-y border-primary/20 py-1.5 tabular-nums")
  for (const [nombre, valor] of [
    ["Latitud", c.latitud.toFixed(4)],
    ["Longitud", c.longitud.toFixed(4)],
  ]) {
    const bloque = crear("div", "flex flex-col")
    bloque.append(crear("span", "hud-etiqueta text-muted-foreground", nombre), crear("span", "font-mono text-sm", valor))
    coordenadas.append(bloque)
  }
  raiz.append(objetivo, cabecera, coordenadas)

  if (!r) {
    raiz.append(crear("span", "text-muted-foreground", "Sin registros válidos todavía."))
    return raiz
  }
  const filas: [string, string, string][] = [
    ["var(--viz-temperatura)", "Temperatura", `${formatearNumero(r.temperaturaMedia)} °C (${formatearNumero(r.temperaturaMin)} a ${formatearNumero(r.temperaturaMax)})`],
    ["var(--viz-humedad)", "Humedad", `${formatearNumero(r.humedadMedia)} %`],
    ["var(--viz-precipitacion)", "Lluvia", `${formatearNumero(r.precipitacionTotal)} mm · ${formatearEntero(r.horasConLluvia)} h`],
  ]
  const lista = crear("dl", "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums")
  for (const [color, nombre, valor] of filas) {
    const dt = crear("dt", "flex items-center gap-1.5 text-muted-foreground")
    const punto = crear("span", "inline-block size-2 rounded-full")
    punto.style.background = color
    dt.append(punto, nombre)
    lista.append(dt, crear("dd", "text-right font-medium", valor))
  }
  raiz.append(lista)
  if (!activa) raiz.append(crear("span", "text-[11px] text-primary-strong", "Pulsa para ver su evolución hora a hora"))
  return raiz
}

const dos = (n: number) => String(n).padStart(2, "0")
const formatoMadrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

function grados(v: number, positivo: string, negativo: string) {
  return `${Math.abs(v).toFixed(1)}°${v >= 0 ? positivo : negativo}`
}

type Lectura = {
  ancho: number
  alto: number
  lons: { x: number; texto: string }[]
  lats: { y: number; texto: string }[]
  zoom: number
  inclinacion: number
  rumbo: number
}

/** Reglas de coordenadas, esquinas del visor y panel de telemetría sobre el hueco libre del mapa. */
function SuperposicionHud({ lectura, cursor, relleno }: { lectura: Lectura | null; cursor: maplibregl.LngLat | null; relleno: Relleno }) {
  const s = useSegundo()
  if (!lectura) return null
  const { ancho, alto } = lectura
  const izq = relleno.left
  const der = ancho - relleno.right
  const arriba = relleno.top
  const abajo = alto - relleno.bottom
  if (der - izq < 160 || abajo - arriba < 120) return null
  const fecha = s === null ? null : new Date(s * 1000)
  const esquina = "absolute size-5 border-primary/80"

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] font-mono text-[10px] text-panel-foreground/80">
      {/* Regla superior: longitudes reales en el borde del hueco libre. */}
      <div
        className="absolute h-5 border-b border-primary/40"
        style={{
          left: izq,
          top: arriba,
          width: der - izq,
          backgroundImage: "repeating-linear-gradient(90deg, color-mix(in oklch, var(--primary) 45%, transparent) 0 1px, transparent 1px 12px)",
          backgroundSize: "100% 4px",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom",
        }}
      >
        {lectura.lons.map((l) => (
          <span key={l.x} className="absolute top-0 -translate-x-1/2 tabular-nums" style={{ left: l.x - izq }}>
            {l.texto}
          </span>
        ))}
      </div>
      {/* Regla izquierda: latitudes. */}
      <div
        className="absolute w-10 border-r border-primary/40"
        style={{
          left: izq,
          top: arriba + 20,
          height: abajo - arriba - 20,
          backgroundImage: "repeating-linear-gradient(180deg, color-mix(in oklch, var(--primary) 45%, transparent) 0 1px, transparent 1px 12px)",
          backgroundSize: "4px 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right",
        }}
      >
        {lectura.lats.map((l) => (
          <span key={l.y} className="absolute left-1 -translate-y-1/2 tabular-nums" style={{ top: l.y - arriba - 20 }}>
            {l.texto}
          </span>
        ))}
      </div>
      {/* Esquinas del visor. */}
      <span className={`${esquina} border-t-2 border-l-2`} style={{ left: izq + 44, top: arriba + 24 }} />
      <span className={`${esquina} border-t-2 border-r-2`} style={{ left: der - 24, top: arriba + 24 }} />
      <span className={`${esquina} border-b-2 border-l-2`} style={{ left: izq + 44, top: abajo - 24 }} />
      <span className={`${esquina} border-r-2 border-b-2`} style={{ left: der - 24, top: abajo - 24 }} />
      {/* Mira central. */}
      <span
        className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30"
        style={{ left: (izq + der) / 2, top: (arriba + abajo) / 2 }}
      >
        <span className="absolute top-1/2 -left-3 h-px w-3 bg-primary/40" />
        <span className="absolute top-1/2 -right-3 h-px w-3 bg-primary/40" />
        <span className="absolute -top-3 left-1/2 h-3 w-px bg-primary/40" />
        <span className="absolute -bottom-3 left-1/2 h-3 w-px bg-primary/40" />
      </span>
      {/* Telemetría. */}
      <div
        className="hud-marco absolute hidden w-56 flex-col gap-1 rounded-md bg-panel/80 p-2.5 ring-1 ring-primary/30 backdrop-blur-md sm:flex"
        style={{ right: ancho - der + 12, top: arriba + 32 }}
      >
        <span className="hud-etiqueta flex items-center justify-between text-primary">
          Seguimiento
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="parpadeo size-1.5 rounded-full bg-emerald-400" />
            Activo
          </span>
        </span>
        <span className="grid grid-cols-2 gap-x-2 tabular-nums">
          <span className="text-panel-foreground/55">UTC</span>
          <span className="text-right">{fecha ? `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}:${dos(fecha.getUTCSeconds())}` : "--:--:--"}</span>
          <span className="text-panel-foreground/55">MADRID</span>
          <span className="text-right">{fecha ? formatoMadrid.format(fecha) : "--:--:--"}</span>
          <span className="text-panel-foreground/55">LAT</span>
          <span className="text-right">{cursor ? cursor.lat.toFixed(4) : "—"}</span>
          <span className="text-panel-foreground/55">LON</span>
          <span className="text-right">{cursor ? cursor.lng.toFixed(4) : "—"}</span>
          <span className="text-panel-foreground/55">ZOOM</span>
          <span className="text-right">{lectura.zoom.toFixed(2)}</span>
          <span className="text-panel-foreground/55">INCLIN.</span>
          <span className="text-right">{Math.round(lectura.inclinacion)}°</span>
          <span className="text-panel-foreground/55">RUMBO</span>
          <span className="text-right">{Math.round((lectura.rumbo + 360) % 360)}°</span>
        </span>
      </div>
      <div className="barrido absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-primary/[0.07] to-transparent" />
    </div>
  )
}

export type PropsMapaInteractivo = {
  clave: string
  resumenes: ReadonlyMap<string, ResumenCiudad>
  metrica: Metrica
  ciudadActiva: string | null
  onSeleccionar: (id: string) => void
  /** Espacio ocupado por los paneles flotantes: el mapa centra las ciudades en el hueco libre. */
  relleno: Relleno
  estilo: EstiloMapa
  /** Relieve 3D (terreno exagerado) y cámara inclinada. */
  modo3d: boolean
  /** Proyección de globo en lugar de Mercator. */
  globo: boolean
}

export default function MapaInteractivo({ clave, resumenes, metrica, ciudadActiva, onSeleccionar, relleno, estilo, modo3d, globo }: PropsMapaInteractivo) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<maplibregl.Map | null>(null)
  const marcadores = React.useRef(new Map<string, { marcador: maplibregl.Marker; punto: HTMLElement; etiqueta: HTMLElement }>())
  const popup = React.useRef<maplibregl.Popup | null>(null)
  const popupHover = React.useRef<maplibregl.Popup | null>(null)
  const seleccionar = React.useRef(onSeleccionar)
  const actual = React.useRef({ resumenes, ciudadActiva, relleno, modo3d, globo })
  const [error, setError] = React.useState<string | null>(null)
  const [lectura, setLectura] = React.useState<Lectura | null>(null)
  const [cursor, setCursor] = React.useState<maplibregl.LngLat | null>(null)
  // `isStyleLoaded()` es falso mientras se descargan teselas; esto solo indica que el estilo y las capas propias existen.
  const estiloListo = React.useRef(false)

  React.useEffect(() => {
    seleccionar.current = onSeleccionar
    actual.current = { resumenes, ciudadActiva, relleno, modo3d, globo }
  }, [onSeleccionar, resumenes, ciudadActiva, relleno, modo3d, globo])

  // Creación del mapa y de un marcador por ciudad (una sola vez).
  React.useEffect(() => {
    if (!contenedor.current) return
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: `https://api.maptiler.com/maps/${ESTILOS[estilo]}/style.json?key=${encodeURIComponent(clave)}`,
      bounds: limitesCiudades(),
      fitBoundsOptions: { padding: ampliar(actual.current.relleno, MARGEN_VISTA) },
      attributionControl: { compact: true },
      maxPitch: 75,
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
    m.addControl(new maplibregl.FullscreenControl(), "top-right")
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }), "top-right")
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right")
    m.on("error", (e) => {
      const estado = (e.error as { status?: number } | undefined)?.status
      if (estado === 401 || estado === 403) setError("MapTiler rechazó la clave. Revisa NEXT_PUBLIC_MAPTILER_KEY.")
    })

    // Cada vez que se carga un estilo (también al cambiarlo) se reponen las capas propias y los modos.
    m.on("style.load", () => {
      anadirCapas(m, clave)
      estiloListo.current = true
      const { modo3d: tresD, globo: esGlobo } = actual.current
      m.setProjection({ type: esGlobo ? "globe" : "mercator" })
      m.setTerrain(tresD ? { source: "terreno", exaggeration: 1.6 } : null)
      m.setLayoutProperty("relieve", "visibility", tresD ? "visible" : "none")
    })

    // Reglas y telemetría: se recalculan como mucho una vez por fotograma.
    let marco = 0
    const medir = () => {
      marco = 0
      const el = m.getContainer()
      const r = actual.current.relleno
      const ancho = el.clientWidth
      const alto = el.clientHeight
      const izq = r.left
      const der = ancho - r.right
      const arriba = r.top
      const abajo = alto - r.bottom
      const lons: Lectura["lons"] = []
      const lats: Lectura["lats"] = []
      const nx = Math.max(2, Math.floor((der - izq) / 110))
      const ny = Math.max(2, Math.floor((abajo - arriba) / 90))
      for (let i = 1; i < nx; i++) {
        const x = izq + ((der - izq) * i) / nx
        const p = m.unproject([x, arriba + 40])
        if (Number.isFinite(p.lng)) lons.push({ x, texto: grados(p.lng, "E", "O") })
      }
      for (let i = 1; i < ny; i++) {
        const y = arriba + ((abajo - arriba) * i) / ny
        const p = m.unproject([izq + 50, y])
        if (Number.isFinite(p.lat)) lats.push({ y, texto: grados(p.lat, "N", "S") })
      }
      setLectura({ ancho, alto, lons, lats, zoom: m.getZoom(), inclinacion: m.getPitch(), rumbo: m.getBearing() })
    }
    const pedirMedida = () => {
      if (!marco) marco = requestAnimationFrame(medir)
    }
    m.on("move", pedirMedida)
    m.on("resize", pedirMedida)
    m.on("load", pedirMedida)
    m.on("mousemove", (e) => setCursor(e.lngLat))
    m.on("mouseout", () => setCursor(null))

    // Paquetes de datos recorriendo los arcos (solo si no se pidió reducir movimiento).
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let animacion = 0
    const animar = (t: number) => {
      const fuente = m.getSource("paquetes") as maplibregl.GeoJSONSource | undefined
      fuente?.setData(geojsonPaquetes(t))
      animacion = requestAnimationFrame(animar)
    }
    if (!quieto) animacion = requestAnimationFrame(animar)

    // Popup rápido al pasar el ratón (o al enfocar con el teclado) sobre una ciudad.
    const mostrarHover = (c: Ciudad) => {
      popupHover.current?.remove()
      if (actual.current.ciudadActiva === c.id) return
      popupHover.current = new maplibregl.Popup({ offset: 16, closeButton: false, closeOnClick: false, maxWidth: "300px", className: "popup-cristal" })
        .setLngLat([c.longitud, c.latitud])
        .setDOMContent(contenidoPopup(c, actual.current.resumenes.get(c.nombre), false))
        .addTo(m)
    }
    const ocultarHover = () => {
      popupHover.current?.remove()
      popupHover.current = null
    }

    const lista = marcadores.current
    CIUDADES.forEach((c, i) => {
      const el = crear("button", "group flex cursor-pointer items-center gap-1.5 focus-visible:outline-none")
      el.type = "button"
      el.setAttribute("aria-label", `Seleccionar ${c.nombre}`)
      const diana = crear("span", "relative flex size-4 items-center justify-center")
      const onda = crear("span", "radar absolute inset-0 rounded-full border border-primary")
      onda.style.setProperty("--retraso", `${i * 240}ms`)
      const punto = crear(
        "span",
        "relative block size-3 rounded-full ring-2 ring-panel shadow-[0_0_10px] shadow-primary transition-transform group-hover:scale-125 group-focus-visible:ring-primary"
      )
      diana.append(onda, punto)
      const etiqueta = crear(
        "span",
        "rounded-sm border-l-2 border-primary bg-panel/85 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-panel-foreground uppercase shadow-sm backdrop-blur-sm tabular-nums whitespace-nowrap"
      )
      el.append(diana, etiqueta)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation()
        ocultarHover()
        seleccionar.current(c.id)
      })
      el.addEventListener("mouseenter", () => mostrarHover(c))
      el.addEventListener("mouseleave", ocultarHover)
      el.addEventListener("focus", () => mostrarHover(c))
      el.addEventListener("blur", ocultarHover)
      // Con relieve 3D, MapLibre atenúa los marcadores que cree tapados por el terreno; aquí siempre se ven.
      const marcador = new maplibregl.Marker({ element: el, anchor: "left", offset: [-8, 0], opacityWhenCovered: "1" })
        .setLngLat([c.longitud, c.latitud])
        .addTo(m)
      lista.set(c.id, { marcador, punto, etiqueta })
    })

    mapa.current = m
    return () => {
      cancelAnimationFrame(animacion)
      cancelAnimationFrame(marco)
      lista.forEach((x) => x.marcador.remove())
      lista.clear()
      m.remove()
      mapa.current = null
    }
    // El estilo inicial solo importa al crear el mapa; los cambios posteriores los aplica el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Cambio de estilo base (satélite u oscuro). "style.load" repone las capas propias.
  const estiloInicial = React.useRef(estilo)
  React.useEffect(() => {
    const m = mapa.current
    if (!m || estiloInicial.current === estilo) return
    estiloInicial.current = estilo
    estiloListo.current = false
    m.setStyle(`https://api.maptiler.com/maps/${ESTILOS[estilo]}/style.json?key=${encodeURIComponent(clave)}`, { diff: false })
  }, [estilo, clave])

  // Relieve 3D: terreno exagerado, sombreado y cámara inclinada.
  React.useEffect(() => {
    const m = mapa.current
    if (!m || !estiloListo.current) return
    m.setTerrain(modo3d ? { source: "terreno", exaggeration: 1.6 } : null)
    m.setLayoutProperty("relieve", "visibility", modo3d ? "visible" : "none")
    m.easeTo({ pitch: modo3d ? 55 : 0, bearing: modo3d ? -15 : 0, zoom: m.getZoom() + (modo3d ? 0.5 : -0.5), duration: 1200 })
  }, [modo3d])

  // Globo: se aleja para ver la curvatura; al volver, se encuadran de nuevo las ciudades.
  React.useEffect(() => {
    const m = mapa.current
    if (!m || !estiloListo.current) return
    m.setProjection({ type: globo ? "globe" : "mercator" })
    const r = actual.current.relleno
    const camara = actual.current.modo3d ? { pitch: 55, bearing: -15 } : { pitch: 0, bearing: 0 }
    if (globo) m.flyTo({ center: [CENTRAL.longitud, CENTRAL.latitud], zoom: 2.2, offset: desplazamiento(r), duration: 1600, ...camara })
    else m.fitBounds(limitesCiudades(), { padding: ampliar(r, MARGEN_VISTA), duration: 1200, ...camara })
  }, [globo])

  // Color y texto de cada marcador según la métrica elegida; el arco de la ciudad activa se resalta.
  React.useEffect(() => {
    const def = METRICAS[metrica]
    const valores = [...resumenes.values()].map(def.valor)
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    for (const c of CIUDADES) {
      const x = marcadores.current.get(c.id)
      if (!x) continue
      const r = resumenes.get(c.nombre)
      const activa = ciudadActiva === c.id
      x.punto.style.background = r ? colorRampa(max > min ? (def.valor(r) - min) / (max - min) : 0.5) : "var(--viz-sin-datos)"
      x.punto.style.transform = activa ? "scale(1.5)" : ""
      x.etiqueta.textContent = r ? `${c.nombre} · ${formatearNumero(def.valor(r))} ${def.unidad}` : c.nombre
      x.etiqueta.style.outline = activa ? "1px solid var(--primary)" : ""
      x.marcador.getElement().style.zIndex = activa ? "2" : "1"
    }
    const m = mapa.current
    if (m?.getLayer("arcos")) {
      m.setPaintProperty("arcos", "line-width", ["case", ["==", ["get", "id"], ciudadActiva ?? ""], 3, 1.2])
      m.setPaintProperty("arcos-halo", "line-opacity", ["case", ["==", ["get", "id"], ciudadActiva ?? ""], 0.6, 0.25])
    }
  }, [resumenes, metrica, ciudadActiva])

  // Vuelo a la ciudad activa (o vista general) y popup fijo con su resumen.
  React.useEffect(() => {
    const m = mapa.current
    if (!m) return
    popup.current?.remove()
    popupHover.current?.remove()
    const r = actual.current.relleno
    const c = CIUDADES.find((x) => x.id === ciudadActiva)
    if (!c) {
      if (!actual.current.globo) m.fitBounds(limitesCiudades(), { padding: ampliar(r, MARGEN_VISTA), duration: 800 })
      return
    }
    m.flyTo({ center: [c.longitud, c.latitud], zoom: ZOOM_CIUDAD, offset: desplazamiento(r), duration: 1400, essential: true })
    popup.current = new maplibregl.Popup({ offset: 16, closeButton: false, closeOnClick: false, maxWidth: "300px", className: "popup-cristal" })
      .setLngLat([c.longitud, c.latitud])
      .setDOMContent(contenidoPopup(c, resumenes.get(c.nombre), true))
      .addTo(m)
  }, [ciudadActiva, resumenes])

  // Al abrir o cerrar paneles, la vista se recoloca en el hueco libre.
  const { top, right, bottom, left } = relleno
  React.useEffect(() => {
    const m = mapa.current
    if (!m) return
    const r = { top, right, bottom, left }
    const c = CIUDADES.find((x) => x.id === actual.current.ciudadActiva)
    if (c) m.easeTo({ center: [c.longitud, c.latitud], offset: desplazamiento(r), duration: 400 })
    else if (!actual.current.globo) m.fitBounds(limitesCiudades(), { padding: ampliar(r, MARGEN_VISTA), duration: 400 })
    m.fire("move")
  }, [top, right, bottom, left])

  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="size-full" role="region" aria-label="Mapa interactivo de las ciudades" />
      <SuperposicionHud lectura={lectura} cursor={cursor} relleno={relleno} />
      {error && (
        <p role="alert" className="absolute inset-x-3 top-3 z-20 rounded-md bg-destructive px-3 py-2 text-sm text-white shadow">
          {error}
        </p>
      )}
    </div>
  )
}
