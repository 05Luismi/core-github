"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  ArrowDownWideNarrowIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudRainIcon,
  DownloadIcon,
  DropletsIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  MapIcon,
  SparklesIcon,
  ThermometerIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { extraerEjemplo } from "@/components/etl/bienvenida"
import { GraficaHoraria } from "@/components/etl/grafica-horaria"
import type { EstiloMapa, Relleno } from "@/components/etl/mapa-interactivo"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatearEntero, formatearNumero } from "@/lib/etl/formato"
import {
  aCsv,
  colorRampa,
  METRICAS,
  RAMPA_SECUENCIAL,
  resumirPorCiudad,
  serieCiudad,
  type Metrica,
} from "@/lib/etl/resumen-ciudades"
import type { RegistroMedicion } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

// MapLibre necesita el navegador (WebGL), así que no se renderiza en el servidor.
const MapaInteractivo = dynamic(() => import("@/components/etl/mapa-interactivo"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />,
})

// La clave de MapTiler es pública por diseño (se usa en el navegador); se restringe por dominio en MapTiler.
const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

const SEPARACION = 12
const ICONOS_METRICA: Record<Metrica, typeof ThermometerIcon> = {
  temperatura: ThermometerIcon,
  humedad: DropletsIcon,
  precipitacion: CloudRainIcon,
}
const TEXTO_CORTO: Record<Metrica, string> = { temperatura: "Temperatura", humedad: "Humedad", precipitacion: "Lluvia" }

function descargarCsv(nombre: string, registros: readonly RegistroMedicion[]) {
  const url = URL.createObjectURL(new Blob([aCsv(registros)], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** Mide un elemento que puede montarse más tarde (ref de callback). */
function useTamano(): [(el: HTMLElement | null) => void, { ancho: number; alto: number }] {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  const [tamano, setTamano] = React.useState({ ancho: 0, alto: 0 })
  React.useEffect(() => {
    if (!el) return
    const obs = new ResizeObserver(() => setTamano({ ancho: el.offsetWidth, alto: el.offsetHeight }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [el])
  // Si el elemento se desmonta, deja de ocupar sitio.
  return [setEl, el ? tamano : { ancho: 0, alto: 0 }]
}

function useEsAncho() {
  return React.useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(min-width: 1024px)")
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true
  )
}

/** Mapa a pantalla completa con paneles flotantes (translúcidos u opacos) y popups por ciudad. */
export function MapaCiudades({ etl, onIrAExtraccion }: { etl: PipelineEtl; onIrAExtraccion: () => void }) {
  const esAncho = useEsAncho()
  const [ciudadActiva, setCiudadActiva] = React.useState<string | null>(null)
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const [ordenarPorMetrica, setOrdenarPorMetrica] = React.useState(false)
  const [listaAbierta, setListaAbierta] = React.useState(esAncho)
  const [graficaAbierta, setGraficaAbierta] = React.useState(true)
  const [opacos, setOpacos] = React.useState(false)
  const [estilo, setEstilo] = React.useState<EstiloMapa>("satelite")
  const [modo3d, setModo3d] = React.useState(false)
  const [globo, setGlobo] = React.useState(false)

  const [panelCiudades, tamCiudades] = useTamano()
  const [panelGrafica, tamGrafica] = useTamano()

  const validos = React.useMemo(() => etl.procesado?.limpieza.validos ?? [], [etl.procesado])
  const resumenes = React.useMemo(() => resumirPorCiudad(validos), [validos])
  const def = METRICAS[metrica]
  const valores = [...resumenes.values()].map(def.valor)
  const min = valores.length ? Math.min(...valores) : 0
  const max = valores.length ? Math.max(...valores) : 0
  const fraccion = (v: number) => (max > min ? (v - min) / (max - min) : 0.5)

  const ciudades = React.useMemo(() => {
    if (!ordenarPorMetrica) return CIUDADES
    const v = (nombre: string) => {
      const r = resumenes.get(nombre)
      return r ? def.valor(r) : -Infinity
    }
    return [...CIUDADES].sort((a, b) => v(b.nombre) - v(a.nombre))
  }, [ordenarPorMetrica, resumenes, def])

  // La gráfica muestra la ciudad activa o, si no hay ninguna, la primera con datos.
  const ciudadGrafica =
    CIUDADES.find((c) => c.id === ciudadActiva) ?? CIUDADES.find((c) => resumenes.has(c.nombre))
  const serie = React.useMemo(
    () => (ciudadGrafica ? serieCiudad(validos, ciudadGrafica.nombre) : []),
    [validos, ciudadGrafica]
  )
  const resumenGrafica = ciudadGrafica ? resumenes.get(ciudadGrafica.nombre) : undefined

  const alternar = React.useCallback((id: string) => {
    setCiudadActiva((prev) => (prev === id ? null : id))
    setGraficaAbierta(true)
  }, [])
  const sufijo = etl.sesion ? `${etl.sesion.inicio}_${etl.sesion.fin}` : "sesion"
  const hayDatos = resumenes.size > 0

  // Hueco que ocupan los paneles: el mapa centra las ciudades en el espacio libre.
  const relleno: Relleno = {
    top: !esAncho ? tamCiudades.alto + SEPARACION : SEPARACION,
    right: esAncho ? 56 : SEPARACION,
    bottom: hayDatos ? tamGrafica.alto + SEPARACION : SEPARACION,
    left: esAncho ? tamCiudades.ancho + SEPARACION : SEPARACION,
  }

  const cristal = cn(
    "hud-marco rounded-xl text-foreground shadow-xl shadow-black/40 ring-1 ring-primary/25 transition-colors",
    opacos ? "bg-panel" : "bg-panel/70 backdrop-blur-md supports-[backdrop-filter]:bg-panel/55"
  )

  return (
    <div
      data-estilo={estilo}
      // El mapa es siempre un visor HUD oscuro, también con el tema claro.
      className="mapa-hud dark relative w-full overflow-hidden bg-panel text-foreground"
      style={{ height: "calc(100dvh - var(--alto-menu, 4rem))" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setCiudadActiva(null)
      }}
    >
      <h1 className="sr-only">Mapa y análisis por ciudad</h1>
      {CLAVE_MAPTILER ? (
        <MapaInteractivo
          clave={CLAVE_MAPTILER}
          resumenes={resumenes}
          metrica={metrica}
          ciudadActiva={ciudadActiva}
          onSeleccionar={alternar}
          relleno={relleno}
          estilo={estilo}
          modo3d={modo3d}
          globo={globo}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className={cn(cristal, "flex max-w-md items-start gap-2 p-4 text-sm")}>
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-strong" />
            <span>
              <strong>Mapa no configurado.</strong> Define <code>NEXT_PUBLIC_MAPTILER_KEY</code> en{" "}
              <code>.env.local</code> y reinicia el servidor de desarrollo.
            </span>
          </p>
        </div>
      )}

      {/* Panel de ciudades: métrica, leyenda y lista. */}
      <section
        ref={panelCiudades}
        aria-label="Ciudades y métrica"
        className={cn(
          cristal,
          "absolute top-3 left-3 z-10 flex flex-col gap-2 p-2.5",
          esAncho ? "max-h-[calc(100%-1.5rem)] w-80" : "right-14 max-h-[55%]"
        )}
      >
        <div className="flex items-center gap-1.5">
          <MapIcon aria-hidden className="size-4 text-primary-strong" />
          <h2 className="hud-etiqueta mr-auto text-[11px] font-semibold">Seguimiento</h2>
          {ciudadActiva && (
            <Button size="xs" variant="ghost" onClick={() => setCiudadActiva(null)} title="Ver todas las ciudades">
              <LocateFixedIcon data-icon="inline-start" />
              Todas
            </Button>
          )}
          <Button
            size="icon-xs"
            variant={ordenarPorMetrica ? "secondary" : "ghost"}
            aria-pressed={ordenarPorMetrica}
            aria-label="Ordenar por la métrica"
            title="Ordenar por la métrica"
            disabled={!hayDatos}
            onClick={() => setOrdenarPorMetrica((v) => !v)}
          >
            <ArrowDownWideNarrowIcon />
          </Button>
          <Button
            size="icon-xs"
            variant={opacos ? "secondary" : "ghost"}
            aria-pressed={opacos}
            aria-label="Paneles opacos"
            title={opacos ? "Paneles opacos (pulsa para transparentes)" : "Paneles transparentes (pulsa para opacos)"}
            onClick={() => setOpacos((v) => !v)}
          >
            <span aria-hidden className={cn("size-3 rounded-full border-2 border-current", opacos && "bg-current")} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-expanded={listaAbierta}
            aria-label={listaAbierta ? "Ocultar lista de ciudades" : "Mostrar lista de ciudades"}
            onClick={() => setListaAbierta((v) => !v)}
          >
            {listaAbierta ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
        </div>

        <div role="radiogroup" aria-label="Métrica del mapa" className="grid grid-cols-3 gap-0.5 rounded-lg bg-foreground/5 p-0.5">
          {(Object.keys(METRICAS) as Metrica[]).map((m) => {
            const Icono = ICONOS_METRICA[m]
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metrica === m}
                title={METRICAS[m].texto}
                onClick={() => setMetrica(m)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  metrica === m ? "bg-primary font-medium text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icono aria-hidden className="size-3.5" />
                {TEXTO_CORTO[m]}
              </button>
            )
          })}
        </div>

        {CLAVE_MAPTILER && (
          <div role="group" aria-label="Modo del mapa" className="grid grid-cols-4 gap-1">
            {[
              { texto: "Satélite", activo: estilo === "satelite", accion: () => setEstilo("satelite") },
              { texto: "Oscuro", activo: estilo === "oscuro", accion: () => setEstilo("oscuro") },
              { texto: "Relieve 3D", activo: modo3d, accion: () => setModo3d((v) => !v) },
              { texto: "Globo", activo: globo, accion: () => setGlobo((v) => !v) },
            ].map((b) => (
              <button
                key={b.texto}
                type="button"
                aria-pressed={b.activo}
                onClick={b.accion}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md border px-1 py-1 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
                  b.activo
                    ? "border-primary bg-primary/15 text-foreground shadow-[0_0_10px] shadow-primary/30"
                    : "border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <span className={cn("hud-etiqueta text-[8px]", b.activo ? "text-primary" : "text-muted-foreground/70")}>
                  {b.activo ? "Activo" : "Inactivo"}
                </span>
                <span className="text-[11px] font-medium whitespace-nowrap">{b.texto}</span>
              </button>
            ))}
          </div>
        )}

        {hayDatos && (
          <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground tabular-nums">
            {formatearNumero(min)} {def.unidad}
            <span aria-hidden className="flex h-2 flex-1 overflow-hidden rounded-full">
              {RAMPA_SECUENCIAL.map((c) => (
                <span key={c} className="block flex-1" style={{ background: c }} />
              ))}
            </span>
            {formatearNumero(max)} {def.unidad}
          </div>
        )}

        {listaAbierta && (
          <ul className="-mr-1 flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
            {ciudades.map((c) => {
              const r = resumenes.get(c.nombre)
              const extraccion = etl.extracciones.find((e) => e.ciudadId === c.id)
              const seleccionada = ciudadActiva === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={seleccionada}
                    onClick={() => alternar(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      seleccionada && "bg-primary/15 ring-1 ring-primary/50"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full shadow-[0_0_8px] shadow-primary/50 ring-1 ring-foreground/15"
                      style={{ background: r ? colorRampa(fraccion(def.valor(r))) : "var(--viz-sin-datos)" }}
                    />
                    <span className="mr-auto truncate font-medium">{c.nombre}</span>
                    {r ? (
                      <span className="font-mono text-xs text-primary-strong tabular-nums">
                        {formatearNumero(def.valor(r))} {def.unidad}
                      </span>
                    ) : extraccion?.estado === "en_curso" ? (
                      <LoaderCircleIcon aria-label="descargando" className="size-3.5 animate-spin text-muted-foreground" />
                    ) : extraccion?.estado === "error" ? (
                      <span className="text-xs text-destructive">Error</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin datos</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Sin datos: un clic para ver el mapa funcionando. */}
      {!hayDatos && (
        <div className="pointer-events-none absolute inset-x-3 bottom-6 z-10 flex justify-center">
          <div className={cn(cristal, "pointer-events-auto flex max-w-md flex-col items-center gap-3 p-5 text-center")}>
            {etl.extrayendo ? (
              <p className="flex items-center gap-2 text-sm">
                <LoaderCircleIcon aria-hidden className="size-4 animate-spin text-primary-strong" />
                Descargando datos… las ciudades se colorearán al terminar.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  <strong>Aún no hay datos en el mapa.</strong>
                  <br />
                  <span className="text-muted-foreground">Carga un ejemplo y verás cada ciudad coloreada por su clima.</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => extraerEjemplo(etl)} disabled={etl.cargando}>
                    <SparklesIcon data-icon="inline-start" />
                    Probar con un ejemplo
                  </Button>
                  <Button variant="outline" onClick={onIrAExtraccion}>
                    Elegir ciudades y fechas
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Panel inferior: evolución horaria de la ciudad elegida. */}
      {hayDatos && ciudadGrafica && (
        <section
          ref={panelGrafica}
          aria-labelledby="titulo-evolucion"
          className={cn(
            cristal,
            "absolute right-3 bottom-3 z-10 flex flex-col gap-1 p-2.5",
            esAncho && listaAbierta ? "left-[21.5rem]" : "left-3"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="titulo-evolucion" className="text-sm font-semibold">
              {ciudadGrafica.nombre}
              <span className="font-normal text-muted-foreground"> · evolución horaria (UTC)</span>
            </h2>
            {resumenGrafica && (
              <dl className="flex flex-wrap gap-x-3 text-xs tabular-nums">
                {[
                  ["Temperatura media", "var(--viz-temperatura)", `${formatearNumero(resumenGrafica.temperaturaMedia)} °C`],
                  ["Humedad media", "var(--viz-humedad)", `${formatearNumero(resumenGrafica.humedadMedia)} %`],
                  ["Precipitación total", "var(--viz-precipitacion)", `${formatearNumero(resumenGrafica.precipitacionTotal)} mm · ${formatearEntero(resumenGrafica.horasConLluvia)} h`],
                ].map(([etiqueta, color, texto]) => (
                  <div key={etiqueta} className="flex items-center gap-1">
                    <dt className="sr-only">{etiqueta}</dt>
                    <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
                    <dd>{texto}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="xs"
                variant="ghost"
                title={`Descargar CSV de ${ciudadGrafica.nombre}`}
                onClick={() => descargarCsv(`validos_${ciudadGrafica.id}_${sufijo}.csv`, serie)}
              >
                <DownloadIcon data-icon="inline-start" />
                CSV
              </Button>
              <Button size="xs" variant="ghost" title="Descargar CSV de todas las ciudades" onClick={() => descargarCsv(`validos_${sufijo}.csv`, validos)}>
                <DownloadIcon data-icon="inline-start" />
                Todas
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-expanded={graficaAbierta}
                aria-label={graficaAbierta ? "Ocultar gráfica" : "Mostrar gráfica"}
                onClick={() => setGraficaAbierta((v) => !v)}
              >
                {graficaAbierta ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </Button>
            </div>
          </div>
          {graficaAbierta && <GraficaHoraria serie={serie} ciudad={ciudadGrafica.nombre} altoPanel={esAncho ? 56 : 40} />}
        </section>
      )}
    </div>
  )
}
