"use client"

import * as React from "react"

import { formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import type { RegistroMedicion } from "@/lib/etl/tipos"

const MARGEN = { izquierda: 44, derecha: 12 }
const ALTO_PANEL = 96
const ALTO_TITULO = 20
const SEPARACION = 14
const ALTO_EJE_X = 22
const DIA_MS = 86_400_000

type Panel = {
  clave: "temperatura_c" | "humedad_pct" | "precipitacion_mm"
  titulo: string
  unidad: string
  color: string
  forma: "linea" | "barras"
  dominio: (valores: number[]) => [number, number]
}

function dominioHolgado(valores: number[]): [number, number] {
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const margen = (max - min) * 0.1 || 1
  return [Math.floor(min - margen), Math.ceil(max + margen)]
}

const PANELES: Panel[] = [
  { clave: "temperatura_c", titulo: "Temperatura", unidad: "°C", color: "var(--viz-temperatura)", forma: "linea", dominio: dominioHolgado },
  { clave: "humedad_pct", titulo: "Humedad relativa", unidad: "%", color: "var(--viz-humedad)", forma: "linea", dominio: () => [0, 100] },
  {
    clave: "precipitacion_mm",
    titulo: "Precipitación",
    unidad: "mm",
    color: "var(--viz-precipitacion)",
    forma: "barras",
    dominio: (v) => [0, Math.max(1, Math.ceil(Math.max(...v)))],
  },
]

export function useAncho(ref: React.RefObject<HTMLElement | null>): number {
  const [ancho, setAncho] = React.useState(0)
  React.useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)))
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return ancho
}

/** Índice del punto más cercano a t (la serie está ordenada por fecha). */
function masCercano(tiempos: number[], t: number): number {
  let lo = 0
  let hi = tiempos.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (tiempos[mid] < t) lo = mid
    else hi = mid
  }
  return Math.abs(tiempos[lo] - t) <= Math.abs(tiempos[hi] - t) ? lo : hi
}

export function GraficaHoraria({
  serie,
  ciudad,
  altoPanel = ALTO_PANEL,
}: {
  serie: RegistroMedicion[]
  ciudad: string
  /** Alto de cada uno de los tres paneles (más bajo para la vista compacta sobre el mapa). */
  altoPanel?: number
}) {
  const caja = React.useRef<HTMLDivElement>(null)
  const ancho = useAncho(caja)
  const [indice, setIndice] = React.useState<number | null>(null)

  const tiempos = React.useMemo(() => serie.map((r) => Date.parse(r.fecha_hora)), [serie])
  const alto = PANELES.length * (ALTO_TITULO + altoPanel + SEPARACION) - SEPARACION + ALTO_EJE_X
  const anchoPlot = Math.max(0, ancho - MARGEN.izquierda - MARGEN.derecha)

  if (serie.length < 2) {
    return (
      <div ref={caja} className="relative w-full">
        <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
          {serie.length ? `Solo hay un registro válido para ${ciudad}.` : `No hay registros válidos de ${ciudad}.`}
        </p>
      </div>
    )
  }

  const t0 = tiempos[0]
  const t1 = tiempos[tiempos.length - 1]
  const x = (t: number) => MARGEN.izquierda + ((t - t0) / (t1 - t0)) * anchoPlot
  const paso = anchoPlot / Math.max(1, (t1 - t0) / 3_600_000)

  // Marcas del eje X en medianoche UTC, espaciadas para que quepan las etiquetas.
  const dias = Math.max(1, Math.round((t1 - t0) / DIA_MS))
  const cadaDias = Math.max(1, Math.ceil(dias / Math.max(1, Math.floor(anchoPlot / 64))))
  const marcasX: number[] = []
  for (let t = Math.ceil(t0 / DIA_MS) * DIA_MS; t <= t1; t += cadaDias * DIA_MS) marcasX.push(t)

  const sel = indice !== null ? serie[indice] : null

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraccion = (e.clientX - rect.left) / rect.width
    setIndice(masCercano(tiempos, t0 + fraccion * (t1 - t0)))
  }

  const teclado = (e: React.KeyboardEvent) => {
    const saltos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, PageUp: 24, PageDown: -24 }
    if (e.key === "Home") setIndice(0)
    else if (e.key === "End") setIndice(serie.length - 1)
    else if (e.key === "Escape") setIndice(null)
    else if (e.key in saltos)
      setIndice((i) => Math.min(serie.length - 1, Math.max(0, (i ?? 0) + saltos[e.key])))
    else return
    e.preventDefault()
  }

  return (
    <div ref={caja} className="relative w-full">
      {ancho > 0 && (
        <svg
          width={ancho}
          height={alto}
          role="img"
          tabIndex={0}
          aria-label={`Evolución horaria en ${ciudad}: temperatura, humedad y precipitación. Usa las flechas para recorrer las horas.`}
          onKeyDown={teclado}
          onBlur={() => setIndice(null)}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          style={{ fontFamily: "inherit" }}
        >
          {PANELES.map((p, n) => {
            const valores = serie.map((r) => r[p.clave])
            const [d0, d1] = p.dominio(valores)
            const arriba = n * (ALTO_TITULO + altoPanel + SEPARACION) + ALTO_TITULO
            const y = (v: number) => arriba + altoPanel - ((v - d0) / (d1 - d0)) * altoPanel
            const marcasY = [d0, (d0 + d1) / 2, d1]
            const ruta = serie.map((r, i) => `${i ? "L" : "M"}${x(tiempos[i]).toFixed(1)},${y(r[p.clave]).toFixed(1)}`).join("")
            const anchoBarra = Math.max(1, paso - (paso > 4 ? 2 : 0))
            return (
              <g key={p.clave}>
                <text x={MARGEN.izquierda} y={arriba - 6} fontSize={12} fontWeight={500} fill="var(--viz-ink)">
                  {p.titulo} ({p.unidad})
                </text>
                {marcasY.map((v) => (
                  <g key={v}>
                    <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke={v === d0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
                    <text x={MARGEN.izquierda - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
                      {formatearNumero(v)}
                    </text>
                  </g>
                ))}
                {p.forma === "linea" ? (
                  <path d={ruta} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ) : (
                  serie.map((r, i) =>
                    r[p.clave] > 0 ? (
                      <rect
                        key={r.fecha_hora}
                        x={x(tiempos[i]) - anchoBarra / 2}
                        y={y(r[p.clave])}
                        width={anchoBarra}
                        height={y(d0) - y(r[p.clave])}
                        rx={anchoBarra >= 8 ? 2 : 0}
                        fill={p.color}
                      />
                    ) : null
                  )
                )}
                {sel && indice !== null && (
                  <circle cx={x(tiempos[indice])} cy={y(sel[p.clave])} r={4} fill={p.color} stroke="var(--viz-surface)" strokeWidth={2} />
                )}
              </g>
            )
          })}

          {marcasX.map((t) => (
            <text key={t} x={x(t)} y={alto - 6} textAnchor="middle" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
              {new Date(t).toISOString().slice(8, 10)}/{new Date(t).toISOString().slice(5, 7)}
            </text>
          ))}

          {sel && indice !== null && (
            <line x1={x(tiempos[indice])} x2={x(tiempos[indice])} y1={ALTO_TITULO} y2={alto - ALTO_EJE_X} stroke="var(--viz-muted)" strokeWidth={1} strokeDasharray="3 3" />
          )}

          <rect
            x={MARGEN.izquierda}
            y={0}
            width={anchoPlot}
            height={alto - ALTO_EJE_X}
            fill="transparent"
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setIndice(null)}
          />
        </svg>
      )}

      {sel && indice !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={
            x(tiempos[indice]) > ancho / 2
              ? { right: ancho - x(tiempos[indice]) + 10 }
              : { left: x(tiempos[indice]) + 10 }
          }
        >
          <p className="font-medium">{formatearFechaUtc(sel.fecha_hora)}</p>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 tabular-nums">
            {PANELES.map((p) => (
              <React.Fragment key={p.clave}>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: p.color }} />
                  {p.titulo}
                </dt>
                <dd className="text-right">
                  {formatearNumero(sel[p.clave])} {p.unidad}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
