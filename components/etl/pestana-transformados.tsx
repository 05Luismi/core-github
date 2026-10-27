"use client"

import { TriangleAlertIcon } from "lucide-react"

import { TablaPaginada, ValorBruto, type Columna } from "@/components/etl/tabla-paginada"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearFechaUtc } from "@/lib/etl/formato"
import type { RegistroTransformado } from "@/lib/etl/tipos"

const COLUMNAS: Columna<RegistroTransformado>[] = [
  { id: "n", encabezado: "#", celda: (_, i) => i, numerica: true, className: "text-muted-foreground" },
  { id: "ciudad", encabezado: "ciudad", celda: (r) => r.ciudad ?? <ValorBruto valor={null} /> },
  { id: "pos", encabezado: "Posición en arrays", celda: (r) => r.indice, numerica: true },
  { id: "orig", encabezado: "time (original)", celda: (r) => <ValorBruto valor={r.fecha_original} /> },
  {
    id: "fecha",
    encabezado: "fecha_hora (UTC)",
    celda: (r) => (r.fecha_hora ? formatearFechaUtc(r.fecha_hora) : <span className="text-destructive">no válida</span>),
  },
  { id: "t", encabezado: "temperatura_c (°C)", celda: (r) => <ValorBruto valor={r.temperatura_c} />, numerica: true },
  { id: "h", encabezado: "humedad_pct (%)", celda: (r) => <ValorBruto valor={r.humedad_pct} />, numerica: true },
  { id: "p", encabezado: "precipitacion_mm (mm)", celda: (r) => <ValorBruto valor={r.precipitacion_mm} />, numerica: true },
]

export function PestanaTransformados({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  if (!p) return <p className="py-6 text-muted-foreground">Sin datos transformados todavía.</p>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Cada posición <em>i</em> de los arrays se convierte en un registro. Los valores se muestran tal
        y como llegaron: <code>null</code>, cadenas vacías o valores ausentes no se convierten en 0. La
        hora se interpreta como UTC aplicando <code>utc_offset_seconds</code>.
      </p>
      {p.incidencias.map((i) => (
        <Alert key={i.ciudad} variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{i.ciudad}: estructura incoherente</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {i.mensajes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ))}
      <TablaPaginada
        etiqueta="Datos transformados"
        filas={p.transformados}
        columnas={COLUMNAS}
        claveFila={(r) => r.uid}
      />
    </div>
  )
}
