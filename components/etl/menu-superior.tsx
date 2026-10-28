"use client"

import * as React from "react"
import {
  CheckIcon,
  CircleAlertIcon,
  CloudSunIcon,
  DatabaseIcon,
  DownloadCloudIcon,
  LoaderCircleIcon,
  MapIcon,
  TableIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { BotonTema } from "@/components/boton-tema"
import { ProgresoGlobal } from "@/components/etl/progreso-global"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero } from "@/lib/etl/formato"

export type Vista = "extraccion" | "pipeline" | "mapa" | "datos" | "carga"

export const VISTAS: { id: Vista; texto: string; icono: LucideIcon; descripcion: string }[] = [
  { id: "extraccion", texto: "Extracción", icono: DownloadCloudIcon, descripcion: "Elige ciudades y fechas y descarga los datos de Open-Meteo." },
  { id: "pipeline", texto: "Pipeline", icono: WorkflowIcon, descripcion: "Sigue cada fase del ETL: entrada, salida, duración y resultado." },
  { id: "mapa", texto: "Mapa", icono: MapIcon, descripcion: "Compara las ciudades en el mapa y explora su evolución hora a hora." },
  { id: "datos", texto: "Datos", icono: TableIcon, descripcion: "Inspecciona los datos de cada fase, filtra y elige qué filas cargar." },
  { id: "carga", texto: "Carga", icono: DatabaseIcon, descripcion: "Revisa el conjunto final, súbelo a Supabase y consulta lo guardado." },
]

/** Indicador pequeño junto a cada apartado del menú: recuento o estado. */
function indicador(vista: Vista, etl: PipelineEtl): React.ReactNode {
  const p = etl.procesado
  switch (vista) {
    case "extraccion":
      if (etl.extrayendo) return <LoaderCircleIcon aria-label="en curso" className="size-3.5 animate-spin" />
      if (etl.extracciones.some((e) => e.estado === "error")) return <CircleAlertIcon aria-label="con errores" className="size-3.5 text-red-400" />
      return etl.extracciones.length ? <CheckIcon aria-label="completada" className="size-3.5" /> : null
    case "pipeline":
      return p ? <CheckIcon aria-label="con datos" className="size-3.5" /> : null
    case "mapa":
      return p ? formatearEntero(new Set(p.limpieza.validos.map((r) => r.ciudad)).size) : null
    case "datos":
      return p ? formatearEntero(p.limpieza.validos.length) : null
    case "carga":
      if (etl.cargando) return <LoaderCircleIcon aria-label="en curso" className="size-3.5 animate-spin" />
      return p ? formatearEntero(etl.conjunto.aCargar.length) : null
  }
}

function EstadoSupabase({ etl }: { etl: PipelineEtl }) {
  const s = etl.estadoSupabase
  const ok = s?.configurado && s.tablaDisponible
  return (
    <p
      role="status"
      title={s && !ok ? (s.mensaje ?? undefined) : "Tabla mediciones_meteorologicas"}
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:flex",
        s && !ok ? "border-red-400/40 bg-red-500/15 text-red-300" : "border-primary/25 text-orange-100/80"
      )}
    >
      {!s ? (
        <>
          <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" />
          Comprobando Supabase…
        </>
      ) : ok ? (
        <>
          <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
          Supabase
          {typeof s.filas === "number" && <span className="tabular-nums text-orange-100/55">· {formatearEntero(s.filas)} filas</span>}
        </>
      ) : (
        <>
          <CircleAlertIcon aria-hidden className="size-3.5" />
          Supabase no disponible
        </>
      )}
    </p>
  )
}

/** Barra superior fija: marca, apartados de la aplicación, estado de Supabase, tema y progreso. */
export function MenuSuperior({
  etl,
  vista,
  onCambiar,
}: {
  etl: PipelineEtl
  vista: Vista
  onCambiar: (v: Vista) => void
}) {
  // Publica la altura del menú (--alto-menu) para que el mapa ocupe exactamente el resto de la pantalla.
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--alto-menu", `${el.offsetHeight}px`)
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <header ref={ref} className="sticky top-0 z-40 border-b border-primary/25 bg-black text-orange-50 shadow-lg shadow-primary/10">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
          <a
            href="#extraccion"
            onClick={(e) => {
              e.preventDefault()
              onCambiar("extraccion")
            }}
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/40">
              <CloudSunIcon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">Pipeline ETL</span>
              <span className="truncate text-xs text-orange-100/55">Open-Meteo → Supabase</span>
            </span>
          </a>

          <nav aria-label="Apartados" className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 md:order-none md:mx-0 md:ml-6 md:w-auto md:flex-1 md:px-0">
            <ul className="flex gap-1">
              {VISTAS.map((v, i) => {
                const activa = v.id === vista
                const extra = indicador(v.id, etl)
                return (
                  <li key={v.id}>
                    <a
                      href={`#${v.id}`}
                      aria-current={activa ? "page" : undefined}
                      onClick={(e) => {
                        e.preventDefault()
                        onCambiar(v.id)
                      }}
                      className={cn(
                        "relative flex h-9 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                        activa ? "bg-primary/15 font-medium text-orange-50" : "text-orange-100/60 hover:bg-primary/10 hover:text-orange-50",
                        "after:absolute after:inset-x-3 after:-bottom-[7px] after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity",
                        activa ? "after:opacity-100" : "after:opacity-0"
                      )}
                    >
                      <v.icono aria-hidden className={cn("size-4", activa && "text-primary")} />
                      <span>
                        <span className="sr-only">{i + 1}. </span>
                        {v.texto}
                      </span>
                      {extra !== null && (
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums",
                            activa ? "bg-primary text-primary-foreground" : "bg-primary/15 text-orange-100/80"
                          )}
                        >
                          {extra}
                        </span>
                      )}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <EstadoSupabase etl={etl} />
            <BotonTema className="border-primary/30 bg-transparent text-orange-50 hover:bg-primary/15 hover:text-orange-50 dark:border-primary/30 dark:bg-transparent dark:hover:bg-primary/15" />
          </div>
        </div>
        <ProgresoGlobal etl={etl} />
      </div>
    </header>
  )
}
