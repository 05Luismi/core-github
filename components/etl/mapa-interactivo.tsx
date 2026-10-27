"use client"

import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { formatearNumero } from "@/lib/etl/formato"
import {
  colorRampa,
  METRICAS,
  type Metrica,
  type ResumenCiudad,
} from "@/lib/etl/resumen-ciudades"

const ESTILO_MAPA = "backdrop-v4"
const ZOOM_CIUDAD = 9

function limitesCiudades(): maplibregl.LngLatBoundsLike {
  const lons = CIUDADES.map((c) => c.longitud)
  const lats = CIUDADES.map((c) => c.latitud)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

/** Contenido del popup construido con nodos de texto: nunca se interpreta HTML. */
function contenidoPopup(c: Ciudad, r: ResumenCiudad | undefined): HTMLElement {
  const raiz = document.createElement("div")
  raiz.className = "flex flex-col gap-1 text-xs text-neutral-900"
  const titulo = document.createElement("strong")
  titulo.className = "text-sm"
  titulo.textContent = c.nombre
  raiz.append(titulo)
  const lineas = r
    ? [
        `${formatearNumero(r.horas)} horas válidas`,
        `Temperatura media: ${formatearNumero(r.temperaturaMedia)} °C (${formatearNumero(r.temperaturaMin)} a ${formatearNumero(r.temperaturaMax)})`,
        `Humedad media: ${formatearNumero(r.humedadMedia)} %`,
        `Precipitación total: ${formatearNumero(r.precipitacionTotal)} mm`,
      ]
    : ["Sin registros válidos todavía."]
  for (const texto of lineas) {
    const p = document.createElement("span")
    p.textContent = texto
    raiz.append(p)
  }
  return raiz
}

export type PropsMapaInteractivo = {
  clave: string
  resumenes: ReadonlyMap<string, ResumenCiudad>
  metrica: Metrica
  ciudadActiva: string | null
  onSeleccionar: (id: string) => void
}

export default function MapaInteractivo({ clave, resumenes, metrica, ciudadActiva, onSeleccionar }: PropsMapaInteractivo) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<maplibregl.Map | null>(null)
  const marcadores = React.useRef(new Map<string, { marcador: maplibregl.Marker; punto: HTMLElement; etiqueta: HTMLElement }>())
  const popup = React.useRef<maplibregl.Popup | null>(null)
  const seleccionar = React.useRef(onSeleccionar)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    seleccionar.current = onSeleccionar
  }, [onSeleccionar])

  // Creación del mapa y de un marcador por ciudad (una sola vez).
  React.useEffect(() => {
    if (!contenedor.current) return
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: `https://api.maptiler.com/maps/${ESTILO_MAPA}/style.json?key=${encodeURIComponent(clave)}`,
      bounds: limitesCiudades(),
      fitBoundsOptions: { padding: 48 },
      cooperativeGestures: true,
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right")
    m.addControl(new maplibregl.FullscreenControl(), "top-right")
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }), "top-right")
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left")
    m.on("error", (e) => {
      const estado = (e.error as { status?: number } | undefined)?.status
      if (estado === 401 || estado === 403) setError("MapTiler rechazó la clave. Revisa NEXT_PUBLIC_MAPTILER_KEY.")
    })

    const lista = marcadores.current
    for (const c of CIUDADES) {
      const el = document.createElement("button")
      el.type = "button"
      el.className = "group flex cursor-pointer items-center gap-1 focus-visible:outline-none"
      el.setAttribute("aria-label", `Seleccionar ${c.nombre}`)
      const punto = document.createElement("span")
      punto.className = "block size-4 rounded-full ring-2 ring-white shadow transition-transform group-focus-visible:ring-sky-500"
      const etiqueta = document.createElement("span")
      etiqueta.className = "rounded bg-white/90 px-1 text-[11px] font-medium text-neutral-900 shadow-sm tabular-nums whitespace-nowrap"
      el.append(punto, etiqueta)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation()
        seleccionar.current(c.id)
      })
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
      x.punto.style.transform = activa ? "scale(1.4)" : ""
      x.etiqueta.textContent = r ? `${c.nombre} · ${formatearNumero(def.valor(r))} ${def.unidad}` : c.nombre
      x.etiqueta.style.outline = activa ? "2px solid #0b0b0b" : ""
      x.marcador.getElement().style.zIndex = activa ? "2" : "1"
    }
  }, [resumenes, metrica, ciudadActiva])

  // Vuelo a la ciudad activa (o vista general) y popup con su resumen.
  React.useEffect(() => {
    const m = mapa.current
    if (!m) return
    popup.current?.remove()
    const c = CIUDADES.find((x) => x.id === ciudadActiva)
    if (!c) {
      m.fitBounds(limitesCiudades(), { padding: 48, duration: 800 })
      return
    }
    m.flyTo({ center: [c.longitud, c.latitud], zoom: ZOOM_CIUDAD, duration: 1200, essential: true })
    popup.current = new maplibregl.Popup({ offset: 14, closeButton: false, maxWidth: "260px" })
      .setLngLat([c.longitud, c.latitud])
      .setDOMContent(contenidoPopup(c, resumenes.get(c.nombre)))
      .addTo(m)
  }, [ciudadActiva, resumenes])

  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="size-full" role="region" aria-label="Mapa interactivo de las ciudades" />
      {error && (
        <p role="alert" className="absolute inset-x-3 top-3 rounded-md bg-destructive px-3 py-2 text-sm text-white shadow">
          {error}
        </p>
      )}
    </div>
  )
}
