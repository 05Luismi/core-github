"use client"

import * as React from "react"
import { DatabaseIcon, DownloadCloudIcon, FilterIcon, ShuffleIcon, BroomSparklesIcon } from "lucide-react"
import { cn } from "cn"

import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { Button } from "@/components/ui/button"
import type { EstadoFase, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearDuracion, formatearEntero } from "@/lib/etl/formato"

export type Pestana =
  | "json"
  | "transformados"
  | "validos"
  | "rechazados"
  | "carga"
  | "supabase"

type Fase = {
  titulo: string
  estado: EstadoFase
  entrada: string
  salida: string
  detalle?: string
  explicacion: string
  duracionMs: number | null
  inspeccionar: { pestana: Pestana; texto: string }[]
}

function estadoExtraccion(etl: PipelineEtl): EstadoFase {
  const e = etl.extracciones
  if (!e.length) return "pendiente"
  if (e.some((c) => c.estado === "en_curso" || c.estado === "pendiente")) return "en_curso"
  if (e.some((c) => c.estado === "error")) return "error"
  return "completada"
}

export function calcularFases(etl: PipelineEtl): Fase[] {
  const p = etl.procesado
  const n = (v: number | undefined | null) => (v === undefined || v === null ? "—" : formatearEntero(v))
  const extraidas = etl.extracciones.filter((c) => c.estado === "completada")
  const lotes = etl.carga?.lotes ?? []
  const procesadosCarga = lotes.reduce((s, l) => s + (l.procesados ?? 0), 0)
  const lotesFallidos = lotes.filter((l) => l.estado === "error").length

  return [
    {
      titulo: "Extracción",
      estado: estadoExtraccion(etl),
      entrada: `${etl.extracciones.length || "—"} peticiones`,
      salida: `${n(extraidas.length ? extraidas.reduce((s, c) => s + (c.filas ?? 0), 0) : null)} horas recibidas`,
      detalle: etl.extracciones.length
        ? `${extraidas.length} de ${etl.extracciones.length} ciudades descargadas`
        : undefined,
      explicacion:
        "Una petición por ciudad a la API histórica. Se guarda el JSON original sin modificar.",
      duracionMs: etl.extracciones.some((c) => c.duracionMs !== null)
        ? etl.extracciones.reduce((s, c) => s + (c.duracionMs ?? 0), 0)
        : null,
      inspeccionar: [{ pestana: "json", texto: "Ver JSON original" }],
    },
    {
      titulo: "Transformación",
      estado: !p ? "pendiente" : p.incidencias.length ? "error" : "completada",
      entrada: `${n(p?.filasEntrada)} posiciones en arrays`,
      salida: `${n(p?.transformados.length)} registros`,
      detalle: p?.incidencias.length
        ? `${p.incidencias.length} ciudades con incidencias de estructura`
        : undefined,
      explicacion:
        "Combina los arrays paralelos de «hourly» en un registro por ciudad y hora, e interpreta las horas como UTC.",
      duracionMs: p?.duracionTransformacionMs ?? null,
      inspeccionar: [{ pestana: "transformados", texto: "Ver transformados" }],
    },
    {
      titulo: "Limpieza",
      estado: p ? "completada" : "pendiente",
      entrada: `${n(p?.transformados.length)} registros`,
      salida: `${n(p?.limpieza.validos.length)} válidos`,
      detalle: p
        ? `${formatearEntero(p.limpieza.rechazados.length)} rechazados (${formatearEntero(p.limpieza.duplicados)} duplicados)`
        : undefined,
      explicacion:
        "Valida tipos y rangos sin convertir null en cero y elimina duplicados por ciudad y hora.",
      duracionMs: p?.duracionLimpiezaMs ?? null,
      inspeccionar: [
        { pestana: "validos", texto: "Válidos" },
        { pestana: "rechazados", texto: "Rechazados" },
      ],
    },
    {
      titulo: "Filtrado y selección",
      estado: etl.validos.length ? "completada" : "pendiente",
      entrada: `${n(p ? etl.validos.length : null)} válidos`,
      salida: `${n(p ? etl.conjunto.aCargar.length : null)} seleccionados`,
      detalle: p
        ? `${formatearEntero(etl.conjunto.coincidentes.length)} coinciden con los filtros`
        : undefined,
      explicacion:
        "Filtros → ordenación → selección manual. Solo se cargan las filas seleccionadas que cumplen los filtros.",
      duracionMs: p ? etl.duracionFiltradoMs : null,
      inspeccionar: [{ pestana: "validos", texto: "Filtrar y seleccionar" }],
    },
    {
      titulo: "Carga",
      estado: etl.carga?.estado ?? "pendiente",
      entrada: `${n(etl.carga?.congelados.length)} registros congelados`,
      salida: `${n(etl.carga ? procesadosCarga : null)} procesados`,
      detalle: etl.carga
        ? `${lotes.length} lotes${lotesFallidos ? ` · ${lotesFallidos} fallidos` : ""}${etl.carga.verificando ? " · verificando" : ""}`
        : undefined,
      explicacion:
        "Upsert en Supabase por lotes de 500 desde el servidor y verificación posterior de las claves.",
      duracionMs: etl.carga?.duracionMs || null,
      inspeccionar: [
        { pestana: "carga", texto: "Vista previa" },
        { pestana: "supabase", texto: "Destino" },
      ],
    },
  ]
}

const ICONOS_FASE = [DownloadCloudIcon, ShuffleIcon, BroomSparklesIcon, FilterIcon, DatabaseIcon]

const COLOR_ESTADO: Record<EstadoFase, string> = {
  pendiente: "var(--viz-sin-datos)",
  en_curso: "var(--primary)",
  completada: "var(--viz-validos)",
  error: "var(--viz-rechazados)",
}

/** Recorrido del pipeline: un nodo circular por fase y paquetes de datos viajando entre las completadas. */
function FlujoPipeline({ fases, onInspeccionar }: { fases: Fase[]; onInspeccionar: (p: Pestana) => void }) {
  return (
    <ol className="hud-marco cristal flex items-start gap-1 overflow-x-auto rounded-xl bg-card p-4 ring-1 ring-primary/20">
      {fases.map((f, i) => {
        const Icono = ICONOS_FASE[i]
        const color = COLOR_ESTADO[f.estado]
        const lleno = f.estado === "completada" || f.estado === "error"
        return (
          <React.Fragment key={f.titulo}>
            <li className="flex min-w-24 flex-1 flex-col items-center gap-1.5 text-center">
              <button
                type="button"
                onClick={() => onInspeccionar(f.inspeccionar[0].pestana)}
                title={`${f.titulo}: ${f.inspeccionar[0].texto}`}
                className={cn(
                  "group relative flex size-16 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
                  f.estado === "en_curso" && "pulso-hud"
                )}
              >
                <svg viewBox="0 0 64 64" className="absolute inset-0" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="none" stroke={color} strokeOpacity={0.35} strokeWidth="1" strokeDasharray="2 4" className="giro" />
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    pathLength={100}
                    strokeDasharray={lleno ? "100 0" : f.estado === "en_curso" ? "30 70" : "4 6"}
                    transform="rotate(-90 32 32)"
                    className={cn(lleno && "arco", f.estado === "en_curso" && "giro")}
                    style={{ filter: f.estado === "pendiente" ? undefined : `drop-shadow(0 0 4px ${color})` }}
                  />
                </svg>
                <Icono aria-hidden className={cn("size-6 transition-transform group-hover:rotate-12", f.estado === "pendiente" && "parpadeo")} style={{ color: f.estado === "pendiente" ? "var(--primary)" : color }} />
              </button>
              <span className="hud-etiqueta text-[10px] text-foreground">{f.titulo}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{f.salida}</span>
            </li>
            {i < fases.length - 1 && (
              <li aria-hidden className="relative mt-8 h-0.5 min-w-6 flex-1">
                <span data-activo={f.estado === "completada"} className="conector absolute inset-0" />
                {f.estado === "completada" && (
                  <>
                    <span className="paquete absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
                    <span className="paquete absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary/70" style={{ animationDelay: "0.7s" }} />
                  </>
                )}
              </li>
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

export function VisualizacionPipeline({
  etl,
  onInspeccionar,
}: {
  etl: PipelineEtl
  onInspeccionar: (p: Pestana) => void
}) {
  const fases = calcularFases(etl)
  return (
    <section aria-labelledby="titulo-pipeline" className="flex flex-col gap-3">
      <h2 id="titulo-pipeline" className="sr-only">
        Fases del pipeline ETL
      </h2>
      <FlujoPipeline fases={fases} onInspeccionar={onInspeccionar} />
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-0">
        {fases.map((f, i) => (
          <React.Fragment key={f.titulo}>
            <li
              style={{ "--retraso": `${i * 90}ms` } as React.CSSProperties}
              className={cn(
                "entrada inclinable hud-marco foco cristal sombra-suave relative flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-primary/15 lg:mr-5",
                f.estado === "en_curso" && "pulso-hud escaneo",
                f.estado === "completada" && "ring-primary/35"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-sm font-semibold">
                  <span className="hud-etiqueta mr-1 text-primary-strong">{String(i + 1).padStart(2, "0")}</span> {f.titulo}
                </h3>
                <EstadoFaseBadge estado={f.estado} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                <dt className="text-muted-foreground">Entrada</dt>
                <dd className="tabular-nums">{f.entrada}</dd>
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="font-medium tabular-nums">{f.salida}</dd>
                <dt className="text-muted-foreground">Duración</dt>
                <dd className="tabular-nums">{formatearDuracion(f.duracionMs)}</dd>
              </dl>
              {f.detalle && <p className="text-xs text-muted-foreground">{f.detalle}</p>}
              <p className="text-xs leading-relaxed text-muted-foreground">{f.explicacion}</p>
              <div className="mt-auto flex flex-wrap gap-1">
                {f.inspeccionar.map((b) => (
                  <Button key={b.pestana + b.texto} size="xs" variant="outline" onClick={() => onInspeccionar(b.pestana)}>
                    {b.texto}
                  </Button>
                ))}
              </div>
              {i < fases.length - 1 && (
                <span
                  aria-hidden
                  data-activo={f.estado === "completada"}
                  className="conector absolute top-1/2 -right-5 hidden h-0.5 w-5 -translate-y-1/2 lg:block"
                />
              )}
            </li>
            {i < fases.length - 1 && (
              <li aria-hidden className="flex justify-center lg:hidden">
                <span data-activo={f.estado === "completada"} className="conector-vertical block h-6 w-0.5" />
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </section>
  )
}
