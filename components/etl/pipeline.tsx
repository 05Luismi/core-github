"use client"

import * as React from "react"
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
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-0">
        {fases.map((f, i) => (
          <React.Fragment key={f.titulo}>
            <li
              style={{ "--retraso": `${i * 90}ms` } as React.CSSProperties}
              className={cn(
                "entrada elevable hud-marco foco cristal sombra-suave relative flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-primary/15 lg:mr-5",
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
