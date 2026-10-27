"use client"

import { TablaPaginada, ValorBruto, type Columna } from "@/components/etl/tabla-paginada"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero, formatearFechaUtc } from "@/lib/etl/formato"
import type { RegistroRechazado } from "@/lib/etl/tipos"

const COLUMNAS: Columna<RegistroRechazado>[] = [
  { id: "n", encabezado: "#", celda: (_, i) => i, numerica: true, className: "text-muted-foreground" },
  { id: "ciudad", encabezado: "ciudad", celda: (r) => r.registro.ciudad ?? <ValorBruto valor={null} /> },
  {
    id: "fecha",
    encabezado: "fecha_hora (UTC)",
    celda: (r) =>
      r.registro.fecha_hora ? formatearFechaUtc(r.registro.fecha_hora) : <ValorBruto valor={r.registro.fecha_original} />,
  },
  { id: "t", encabezado: "temperatura_c (°C)", celda: (r) => <ValorBruto valor={r.registro.temperatura_c} />, numerica: true },
  { id: "h", encabezado: "humedad_pct (%)", celda: (r) => <ValorBruto valor={r.registro.humedad_pct} />, numerica: true },
  { id: "p", encabezado: "precipitacion_mm (mm)", celda: (r) => <ValorBruto valor={r.registro.precipitacion_mm} />, numerica: true },
  {
    id: "motivo",
    encabezado: "Motivo del rechazo",
    celda: (r) => (
      <ul className="text-xs whitespace-normal">
        {r.motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ),
    className: "min-w-64",
  },
]

export function PestanaRechazados({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  if (!p) return <p className="py-6 text-muted-foreground">Sin datos limpiados todavía.</p>
  const excluidosPorFiltros = etl.validos.length - etl.conjunto.coincidentes.length
  const motivos = new Map<string, number>()
  for (const r of p.limpieza.rechazados)
    for (const m of r.motivos) {
      const tipo = m.replace(/\s*\(.*\)$/, "").replace(/^Duplicado de .*/, "Duplicado")
      motivos.set(tipo, (motivos.get(tipo) ?? 0) + 1)
    }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Descartes <strong>por calidad</strong> en la fase de limpieza. Son distintos de los{" "}
        {formatearEntero(excluidosPorFiltros)} registros excluidos ahora mismo <strong>por los
        filtros</strong>: esos siguen siendo válidos y no aparecen aquí. Ante duplicados por (ciudad,
        fecha_hora) se conserva la primera aparición válida en el orden de extracción.
      </p>
      {motivos.size > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {[...motivos].map(([m, n]) => (
            <li key={m} className="rounded-full border px-2 py-0.5">
              {m}: <strong className="tabular-nums">{formatearEntero(n)}</strong>
            </li>
          ))}
        </ul>
      )}
      <TablaPaginada
        etiqueta="Registros rechazados"
        filas={p.limpieza.rechazados}
        columnas={COLUMNAS}
        claveFila={(r) => r.registro.uid}
        vacio="Ningún registro rechazado: todos superan las reglas de calidad."
      />
    </div>
  )
}
