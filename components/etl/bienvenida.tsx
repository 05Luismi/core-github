"use client"

import type * as React from "react"
import { DatabaseIcon, DownloadCloudIcon, FilterIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"

/** Extracción corta para ver la aplicación funcionando en pocos segundos. */
export const EJEMPLO = {
  inicio: "2026-09-01",
  fin: "2026-09-03",
  ciudadIds: ["madrid", "bilbao", "sevilla"],
}

export function extraerEjemplo(etl: PipelineEtl) {
  etl.extraer(EJEMPLO.inicio, EJEMPLO.fin, EJEMPLO.ciudadIds)
}

const PASOS = [
  { icono: DownloadCloudIcon, titulo: "Extrae", texto: "Mediciones horarias reales de Open-Meteo para varias ciudades." },
  { icono: FilterIcon, titulo: "Limpia y filtra", texto: "Mira qué registros se rechazan y elige cuáles quieres cargar." },
  { icono: DatabaseIcon, titulo: "Carga", texto: "Súbelos a Supabase por lotes y comprueba que han llegado." },
]

/** Estado vacío: se muestra hasta la primera extracción. */
export function Bienvenida({ etl, onConfigurar }: { etl: PipelineEtl; onConfigurar: () => void }) {
  return (
    <section
      aria-labelledby="titulo-bienvenida"
      className="entrada sombra-suave hud-marco cristal flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 ring-1 ring-primary/25 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="titulo-bienvenida" className="text-lg font-semibold">
          Empieza aquí: un pipeline ETL con datos reales
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Prueba un ejemplo ya preparado o elige tus propias ciudades y fechas en el panel de
          configuración.
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PASOS.map((p, i) => (
          <li
            key={p.titulo}
            className="entrada elevable hud-marco foco cristal group flex gap-3 rounded-xl bg-card/80 p-3 ring-1 ring-primary/15"
            style={{ "--retraso": `${120 + i * 90}ms` } as React.CSSProperties}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel text-primary shadow-md shadow-primary/25 transition-transform duration-200 group-hover:scale-110">
              <p.icono aria-hidden className="size-4.5" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {i + 1}. {p.titulo}
              </span>
              <span className="text-xs text-muted-foreground">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" disabled={etl.extrayendo || etl.cargando} onClick={() => extraerEjemplo(etl)}>
          <SparklesIcon data-icon="inline-start" />
          Probar con un ejemplo
        </Button>
        <Button size="lg" variant="outline" onClick={onConfigurar}>
          Configurar manualmente
        </Button>
        <span className="text-xs text-muted-foreground">
          Ejemplo: Madrid, Bilbao y Sevilla · 1–3 sep. 2026 · 216 registros
        </span>
      </div>
    </section>
  )
}
