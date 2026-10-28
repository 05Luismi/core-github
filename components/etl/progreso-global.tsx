"use client"

import { Progress } from "@/components/ui/progress"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"

/** Progreso de la extracción o de la carga en curso. Devuelve null si no hay nada en marcha. */
export function calcularProgreso(etl: PipelineEtl): { valor: number; texto: string } | null {
  if (etl.extrayendo) {
    const lista = etl.extracciones
    const hechas = lista.filter((e) => e.estado === "completada" || e.estado === "error").length
    const actual = lista.find((e) => e.estado === "en_curso")
    return {
      valor: lista.length ? (hechas / lista.length) * 100 : 0,
      texto: actual
        ? `Descargando ${actual.nombre} (${hechas + 1} de ${lista.length})`
        : `Procesando ${lista.length} ciudades…`,
    }
  }
  if (etl.cargando && etl.carga) {
    const lotes = etl.carga.lotes
    const hechos = lotes.filter((l) => l.estado === "completado" || l.estado === "error").length
    return {
      valor: lotes.length ? (hechos / lotes.length) * 100 : 0,
      texto: etl.carga.verificando
        ? "Verificando en Supabase…"
        : `Subiendo lote ${Math.min(hechos + 1, lotes.length)} de ${lotes.length}`,
    }
  }
  return null
}

/** Progreso dentro del menú superior: visible desde cualquier apartado. */
export function ProgresoGlobal({ etl }: { etl: PipelineEtl }) {
  const p = calcularProgreso(etl)
  if (!p) return null
  const valor = Math.round(p.valor)
  return (
    <div className="flex flex-col gap-1.5 pb-2.5" aria-live="polite">
      <div className="flex justify-between gap-3 text-xs text-orange-100/80">
        <span className="truncate">{p.texto}</span>
        <span className="tabular-nums">{valor} %</span>
      </div>
      <Progress value={valor} aria-label={p.texto} />
    </div>
  )
}
