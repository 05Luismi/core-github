"use client"

import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { useNumeroAnimado } from "@/hooks/use-numero-animado"
import { formatearEntero } from "@/lib/etl/formato"

function Valor({ valor }: { valor: number | undefined }) {
  const animado = useNumeroAnimado(valor ?? 0)
  return <>{valor === undefined ? "—" : formatearEntero(animado)}</>
}

export function Contadores({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  const items = [
    { etiqueta: "Total extraído", valor: p?.transformados.length, ayuda: "registros ciudad-hora" },
    { etiqueta: "Válidos", valor: p?.limpieza.validos.length, ayuda: "superan la limpieza" },
    { etiqueta: "Rechazados", valor: p?.limpieza.rechazados.length, ayuda: "por calidad o duplicado" },
    { etiqueta: "Coinciden con los filtros", valor: p ? etl.conjunto.coincidentes.length : undefined, ayuda: "de los válidos" },
    { etiqueta: "Seleccionados para cargar", valor: p ? etl.conjunto.aCargar.length : undefined, ayuda: "seleccionados y dentro de filtros", destacado: true },
  ]
  return (
    <section aria-label="Contadores del pipeline" className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((i, n) => (
          <div
            key={i.etiqueta}
            style={{ "--retraso": `${n * 50}ms` } as React.CSSProperties}
            className={cn(
              "entrada elevable rounded-xl p-3",
              i.destacado
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/35"
                : n === 0
                  ? "bg-black text-orange-50 shadow-lg shadow-primary/20"
                  : "sombra-suave bg-card ring-1 ring-primary/15"
            )}
          >
            <dt className="text-xs opacity-80">{i.etiqueta}</dt>
            <dd className={cn("text-2xl font-semibold tabular-nums", n === 0 && "text-primary")}>
              <Valor valor={i.valor} />
            </dd>
            <dd className="text-xs opacity-70">{i.ayuda}</dd>
          </div>
        ))}
      </dl>
      {etl.conjunto.seleccionadosFuera > 0 && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlertIcon aria-hidden className="size-4" />
          {formatearEntero(etl.conjunto.seleccionadosFuera)} filas seleccionadas quedan fuera de los
          filtros actuales y no se subirán (siguen seleccionadas por si cambias los filtros).
        </p>
      )}
    </section>
  )
}
