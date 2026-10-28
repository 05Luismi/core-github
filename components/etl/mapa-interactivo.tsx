"use client"

import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { formatearEntero, formatearNumero } from "@/lib/etl/formato"
import {
  colorRampa,
  METRICAS,
  type Metrica,
  type ResumenCiudad,
} from "@/lib/etl/resumen-ciudades"

const ESTILO_MAPA = "backdrop-v4"
const ZOOM_CIUDAD = 9
const MARGEN_VISTA = 48

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

function crear<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string) {
  const el = document.createElement(etiqueta)
  el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/** Contenido del popup construido con nodos de texto: nunca se interpreta HTML. */
function contenidoPopup(c: Ciudad, r: ResumenCiudad | undefined, activa: boolean): HTMLElement {
  const raiz = crear("div", "flex min-w-52 flex-col gap-2 text-xs")
  const cabecera = crear("div", "flex items-baseline justify-between gap-3")
  cabecera.append(crear("strong", "text-sm", c.nombre))
  if (r) cabecera.append(crear("span", "text-muted-foreground tabular-nums", `${formatearEntero(r.horas)} h válidas`))
  raiz.append(cabecera)

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

export type PropsMapaInteractivo = {
  clave: string
  resumenes: ReadonlyMap<string, ResumenCiudad>
  metrica: Metrica
  ciudadActiva: string | null
  onSeleccionar: (id: string) => void
  /** Espacio ocupado por los paneles flotantes: el mapa centra las ciudades en el hueco libre. */
  relleno: Relleno
}

export default function MapaInteractivo({ clave, resumenes, metrica, ciudadActiva, onSeleccionar, relleno }: PropsMapaInteractivo) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<maplibregl.Map | null>(null)
  const marcadores = React.useRef(new Map<string, { marcador: maplibregl.Marker; punto: HTMLElement; etiqueta: HTMLElement }>())
  const popup = React.useRef<maplibregl.Popup | null>(null)
  const popupHover = React.useRef<maplibregl.Popup | null>(null)
  const seleccionar = React.useRef(onSeleccionar)
  const actual = React.useRef({ resumenes, ciudadActiva, relleno })
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    seleccionar.current = onSeleccionar
    actual.current = { resumenes, ciudadActiva, relleno }
  }, [onSeleccionar, resumenes, ciudadActiva, relleno])

  // Creación del mapa y de un marcador por ciudad (una sola vez).
  React.useEffect(() => {
    if (!contenedor.current) return
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: `https://api.maptiler.com/maps/${ESTILO_MAPA}/style.json?key=${encodeURIComponent(clave)}`,
      bounds: limitesCiudades(),
      fitBoundsOptions: { padding: ampliar(actual.current.relleno, MARGEN_VISTA) },
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right")
    m.addControl(new maplibregl.FullscreenControl(), "top-right")
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }), "top-right")
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right")
    m.on("error", (e) => {
      const estado = (e.error as { status?: number } | undefined)?.status
      if (estado === 401 || estado === 403) setError("MapTiler rechazó la clave. Revisa NEXT_PUBLIC_MAPTILER_KEY.")
    })

    // Popup rápido al pasar el ratón (o al enfocar con el teclado) sobre una ciudad.
    const mostrarHover = (c: Ciudad) => {
      popupHover.current?.remove()
      if (actual.current.ciudadActiva === c.id) return
      popupHover.current = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false, maxWidth: "280px", className: "popup-cristal" })
        .setLngLat([c.longitud, c.latitud])
        .setDOMContent(contenidoPopup(c, actual.current.resumenes.get(c.nombre), false))
        .addTo(m)
    }
    const ocultarHover = () => {
      popupHover.current?.remove()
      popupHover.current = null
    }

    const lista = marcadores.current
    for (const c of CIUDADES) {
      const el = document.createElement("button")
      el.type = "button"
      el.className = "group flex cursor-pointer items-center gap-1 focus-visible:outline-none"
      el.setAttribute("aria-label", `Seleccionar ${c.nombre}`)
      const punto = document.createElement("span")
      punto.className = "block size-4 rounded-full ring-2 ring-white shadow transition-transform group-hover:scale-125 group-focus-visible:ring-primary"
      const etiqueta = document.createElement("span")
      etiqueta.className = "rounded-md bg-background/80 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm tabular-nums whitespace-nowrap"
      el.append(punto, etiqueta)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation()
        ocultarHover()
        seleccionar.current(c.id)
      })
      el.addEventListener("mouseenter", () => mostrarHover(c))
      el.addEventListener("mouseleave", ocultarHover)
      el.addEventListener("focus", () => mostrarHover(c))
      el.addEventListener("blur", ocultarHover)
      const marcador = new maplibregl.Marker({ element: el, anchor: "left", offset: [-8, 0] })
        .setLngLat([c.longitud, c.latitud])
        .addTo(m)
      lista.set(c.id, { marcador, punto, etiqueta })
    }

    mapa.current = m
    return () => {
      lista.forEach((x) => x.marcador.remove())
      lista.clear()
      m.remove()
      mapa.current = null
    }
  }, [clave])

  // Color y texto de cada marcador según la métrica elegida.
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
      x.etiqueta.style.outline = activa ? "2px solid var(--primary)" : ""
      x.marcador.getElement().style.zIndex = activa ? "2" : "1"
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
      m.fitBounds(limitesCiudades(), { padding: ampliar(r, MARGEN_VISTA), duration: 800 })
      return
    }
    m.flyTo({ center: [c.longitud, c.latitud], zoom: ZOOM_CIUDAD, offset: desplazamiento(r), duration: 1200, essential: true })
    popup.current = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false, maxWidth: "280px", className: "popup-cristal" })
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
    else m.fitBounds(limitesCiudades(), { padding: ampliar(r, MARGEN_VISTA), duration: 400 })
  }, [top, right, bottom, left])

  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="size-full" role="region" aria-label="Mapa interactivo de las ciudades" />
      {error && (
        <p role="alert" className="absolute inset-x-3 top-3 z-20 rounded-md bg-destructive px-3 py-2 text-sm text-white shadow">
          {error}
        </p>
      )}
    </div>
  )
}
