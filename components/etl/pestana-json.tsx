"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero } from "@/lib/etl/formato"

function descargarJson(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function PestanaJson({ etl }: { etl: PipelineEtl }) {
  const [elegida, setElegida] = React.useState<string | null>(null)
  const disponibles = etl.extracciones.filter((e) => e.json !== undefined)
  const actual = disponibles.find((e) => e.ciudadId === elegida) ?? disponibles[0]
  const s = etl.sesion

  if (!etl.extracciones.length)
    return <p className="py-6 text-muted-foreground">Aún no hay extracciones en esta sesión.</p>

  const sufijo = s ? `${s.inicio}_${s.fin}` : "sesion"
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Respuestas exactas de Open-Meteo. Se conservan en memoria durante la sesión (al recargar la
        página se pierden). Observa que <code>hourly</code> contiene arrays paralelos: la posición{" "}
        <em>i</em> de cada array corresponde a la hora <code>time[i]</code>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {etl.extracciones.map((e) => (
          <Button
            key={e.ciudadId}
            size="sm"
            variant={actual?.ciudadId === e.ciudadId ? "default" : "outline"}
            disabled={e.json === undefined}
            aria-pressed={actual?.ciudadId === e.ciudadId}
            onClick={() => setElegida(e.ciudadId)}
          >
            {e.nombre}
            {e.estado === "error" && " (error)"}
          </Button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={!disponibles.length}
          onClick={() =>
            descargarJson(
              `open-meteo_todas_${sufijo}.json`,
              Object.fromEntries(disponibles.map((e) => [e.nombre, e.json]))
            )
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Descargar todos
        </Button>
      </div>
      {actual ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <EstadoFaseBadge estado={actual.estado} texto="Descargada" />
            <span>{formatearEntero(actual.filas ?? 0)} horas</span>
            {actual.descargadoEn && <span>· recibido {actual.descargadoEn.replace("T", " ").slice(0, 19)} UTC</span>}
            <Button
              size="xs"
              variant="outline"
              className="ml-auto"
              onClick={() => descargarJson(`open-meteo_${actual.ciudadId}_${sufijo}.json`, actual.json)}
            >
              <DownloadIcon data-icon="inline-start" />
              Descargar {actual.nombre}
            </Button>
          </div>
          {actual.url && (
            <p className="text-xs break-all">
              <span className="text-muted-foreground">Petición: </span>
              <code>{actual.url}</code>
            </p>
          )}
          <pre className="hud-marco max-h-[28rem] overflow-auto rounded-lg border border-primary/25 bg-panel/90 p-3 font-mono text-xs leading-relaxed text-panel-foreground/90 shadow-[inset_0_0_30px] shadow-primary/10">
            {JSON.stringify(actual.json, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-muted-foreground">Ninguna ciudad se ha descargado correctamente todavía.</p>
      )}
    </div>
  )
}
