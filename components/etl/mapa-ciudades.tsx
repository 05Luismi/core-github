"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ArrowDownWideNarrowIcon, DownloadIcon, LocateFixedIcon, MapIcon, TriangleAlertIcon } from "lucide-react"

import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { GraficaHoraria } from "@/components/etl/grafica-horaria"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function descargarCsv(nombre: string, registros: readonly RegistroMedicion[]) {
  const url = URL.createObjectURL(new Blob([aCsv(registros)], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function MapaCiudades({ etl }: { etl: PipelineEtl }) {
  const [ciudadActiva, setCiudadActiva] = React.useState<string | null>(null)
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const [ordenarPorMetrica, setOrdenarPorMetrica] = React.useState(false)
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

  const alternar = React.useCallback((id: string) => setCiudadActiva((prev) => (prev === id ? null : id)), [])
  const sufijo = etl.sesion ? `${etl.sesion.inicio}_${etl.sesion.fin}` : "sesion"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon aria-hidden className="size-4" />
          Mapa y análisis por ciudad
        </CardTitle>
        <CardDescription>
          Cada punto es una ciudad de extracción; su color indica la métrica elegida sobre los registros
          válidos. Pulsa un punto o una ciudad de la lista para acercarte y ver su evolución horaria.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Métrica del mapa" className="inline-flex rounded-lg bg-muted p-0.5">
            {(Object.keys(METRICAS) as Metrica[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metrica === m}
                onClick={() => setMetrica(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  metrica === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {METRICAS[m].texto}
              </button>
            ))}
          </div>
          <Leyenda min={min} max={max} unidad={def.unidad} hayDatos={valores.length > 0} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="relative min-h-80 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 lg:min-h-[32rem]">
            {CLAVE_MAPTILER ? (
              <MapaInteractivo
                clave={CLAVE_MAPTILER}
                resumenes={resumenes}
                metrica={metrica}
                ciudadActiva={ciudadActiva}
                onSeleccionar={alternar}
              />
            ) : (
              <Alert className="m-3 w-auto">
                <TriangleAlertIcon />
                <AlertTitle>Mapa no configurado</AlertTitle>
                <AlertDescription>
                  Define <code>NEXT_PUBLIC_MAPTILER_KEY</code> en <code>.env.local</code> y reinicia el
                  servidor de desarrollo.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!ciudadActiva} onClick={() => setCiudadActiva(null)}>
                <LocateFixedIcon data-icon="inline-start" />
                Ver todas
              </Button>
              <Button
                type="button"
                variant={ordenarPorMetrica ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={ordenarPorMetrica}
                disabled={resumenes.size === 0}
                onClick={() => setOrdenarPorMetrica((v) => !v)}
              >
                <ArrowDownWideNarrowIcon data-icon="inline-start" />
                Ordenar por métrica
              </Button>
            </div>
            <ul className="flex flex-col gap-1.5 lg:max-h-[29rem] lg:overflow-y-auto lg:pr-1">
              {ciudades.map((c) => {
                const extraccion = etl.extracciones.find((e) => e.ciudadId === c.id)
                const r = resumenes.get(c.nombre)
                const seleccionada = ciudadActiva === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={seleccionada}
                      onClick={() => alternar(c.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg p-2 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        seleccionada && "bg-muted ring-2 ring-primary/60"
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full ring-1 ring-foreground/10"
                            style={{ background: r ? colorRampa(fraccion(def.valor(r))) : "var(--viz-sin-datos)" }}
                          />
                          {c.nombre}
                        </span>
                        {extraccion ? (
                          <EstadoFaseBadge
                            estado={extraccion.estado}
                            texto={extraccion.estado === "completada" ? "Descargada" : extraccion.estado === "error" ? "Error" : undefined}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin extraer</span>
                        )}
                      </span>
                      {r ? (
                        <span className="grid grid-cols-3 gap-1 text-xs text-muted-foreground tabular-nums">
                          <span title="Temperatura media (mín. – máx.)">
                            <span className="text-foreground">{formatearNumero(r.temperaturaMedia)} °C</span>
                            <br />
                            {formatearNumero(r.temperaturaMin)} – {formatearNumero(r.temperaturaMax)}
                          </span>
                          <span title="Humedad media">
                            <span className="text-foreground">{formatearNumero(r.humedadMedia)} %</span>
                            <br />
                            humedad
                          </span>
                          <span title="Precipitación total y horas con lluvia">
                            <span className="text-foreground">{formatearNumero(r.precipitacionTotal)} mm</span>
                            <br />
                            {formatearEntero(r.horasConLluvia)} h lluvia
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatearNumero(c.latitud)}, {formatearNumero(c.longitud)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <section aria-labelledby="titulo-evolucion" className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 id="titulo-evolucion" className="text-sm font-medium">
                Evolución horaria{ciudadGrafica && resumenes.size > 0 ? ` · ${ciudadGrafica.nombre}` : ""}
              </h3>
              <p className="text-xs text-muted-foreground">
                Horas en UTC. Pasa el cursor (o usa las flechas) para ver cada hora; la tabla completa está en
                «Registros válidos».
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={serie.length === 0}
                onClick={() => ciudadGrafica && descargarCsv(`validos_${ciudadGrafica.id}_${sufijo}.csv`, serie)}
              >
                <DownloadIcon data-icon="inline-start" />
                CSV {ciudadGrafica?.nombre}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={validos.length === 0}
                onClick={() => descargarCsv(`validos_${sufijo}.csv`, validos)}
              >
                <DownloadIcon data-icon="inline-start" />
                CSV todas
              </Button>
            </div>
          </div>
          {ciudadGrafica && resumenes.size > 0 ? (
            <GraficaHoraria serie={serie} ciudad={ciudadGrafica.nombre} />
          ) : (
            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
              Extrae datos para ver la evolución horaria de cada ciudad.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function Leyenda({ min, max, unidad, hayDatos }: { min: number; max: number; unidad: string; hayDatos: boolean }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {hayDatos && (
        <span className="flex items-center gap-1.5 tabular-nums">
          {formatearNumero(min)} {unidad}
          <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full">
            {RAMPA_SECUENCIAL.map((c) => (
              <span key={c} className="block w-5" style={{ background: c }} />
            ))}
          </span>
          {formatearNumero(max)} {unidad}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--viz-sin-datos)" }} />
        Sin datos
      </span>
    </div>
  )
}
