"use client"

import * as React from "react"
import { CloudRainIcon, DropletsIcon, ThermometerIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { useAncho } from "@/components/etl/grafica-horaria"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero, formatearNumero } from "@/lib/etl/formato"
import {
  contarPorCiudad,
  METRICAS,
  resumirPorCiudad,
  resumirPorDia,
  type ConteoCiudad,
  type Metrica,
  type ResumenCiudad,
  type ResumenDia,
} from "@/lib/etl/resumen-ciudades"

const ICONOS: Record<Metrica, LucideIcon> = {
  temperatura: ThermometerIcon,
  humedad: DropletsIcon,
  precipitacion: CloudRainIcon,
}
const NOMBRES: Record<Metrica, string> = { temperatura: "Temperatura", humedad: "Humedad", precipitacion: "Lluvia" }

function SelectorMetrica({ valor, onCambiar }: { valor: Metrica; onCambiar: (m: Metrica) => void }) {
  return (
    <div role="radiogroup" aria-label="Métrica de las gráficas" className="flex rounded-xl bg-black p-1 shadow-md shadow-primary/15">
      {(Object.keys(METRICAS) as Metrica[]).map((m) => {
        const Icono = ICONOS[m]
        const activa = m === valor
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambiar(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              activa ? "bg-primary text-primary-foreground shadow-md shadow-primary/40" : "text-orange-100/70 hover:bg-primary/15 hover:text-orange-50"
            )}
          >
            <Icono aria-hidden className="size-3.5" />
            {NOMBRES[m]}
          </button>
        )
      })}
    </div>
  )
}

function Tarjeta({
  titulo,
  subtitulo,
  leyenda,
  retraso = 0,
  className,
  children,
}: {
  titulo: string
  subtitulo: string
  leyenda?: React.ReactNode
  retraso?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <figure
      className={cn("entrada elevable sombra-suave flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-primary/15", className)}
      style={{ "--retraso": `${retraso}ms` } as React.CSSProperties}
    >
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{titulo}</span>
          <span className="text-xs text-muted-foreground">{subtitulo}</span>
        </span>
        {leyenda}
      </figcaption>
      {children}
    </figure>
  )
}

function Muestra({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} />
      {texto}
    </span>
  )
}

/** Tooltip de una fila: aparece al pasar el ratón o al enfocarla con el teclado. */
function Globo({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-2 bottom-full z-20 mb-1 hidden min-w-40 flex-col gap-0.5 rounded-lg bg-black px-2.5 py-1.5 text-xs text-orange-50 shadow-lg shadow-primary/25 group-hover:flex group-focus-visible:flex"
    >
      {children}
    </span>
  )
}

function FilaGlobo({ color, texto, valor }: { color?: string; texto: string; valor: string }) {
  return (
    <span className="flex items-center justify-between gap-3 tabular-nums">
      <span className="flex items-center gap-1.5 text-orange-100/70">
        {color && <span className="inline-block size-2 rounded-full" style={{ background: color }} />}
        {texto}
      </span>
      <span className="font-medium">{valor}</span>
    </span>
  )
}

const CLASE_FILA =
  "group relative grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"

/** Barras apiladas horizontales: válidos y rechazados por ciudad. */
function RegistrosPorCiudad({ conteos }: { conteos: ConteoCiudad[] }) {
  const max = Math.max(1, ...conteos.map((c) => c.validos + c.rechazados))
  return (
    <ul className="flex flex-col gap-0.5">
      {conteos.map((c, i) => {
        const total = c.validos + c.rechazados
        return (
          <li
            key={c.ciudad}
            tabIndex={0}
            aria-label={`${c.ciudad}: ${formatearEntero(c.validos)} válidos y ${formatearEntero(c.rechazados)} rechazados`}
            className={CLASE_FILA}
          >
            <span className="truncate text-xs font-medium">{c.ciudad}</span>
            <span className="flex h-4 items-center">
              <span
                className="crecer-x flex h-full gap-0.5"
                style={{ width: `${(total / max) * 100}%`, "--retraso": `${i * 60}ms` } as React.CSSProperties}
              >
                {c.validos > 0 && (
                  <span
                    className={cn("h-full min-w-[3px]", c.rechazados === 0 && "rounded-r-[4px]")}
                    style={{ flexGrow: c.validos, background: "var(--viz-validos)" }}
                  />
                )}
                {c.rechazados > 0 && (
                  <span className="h-full min-w-[3px] rounded-r-[4px]" style={{ flexGrow: c.rechazados, background: "var(--viz-rechazados)" }} />
                )}
              </span>
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {formatearEntero(c.validos)}
              {c.rechazados > 0 && <span className="text-[11px]"> / {formatearEntero(c.rechazados)}</span>}
            </span>
            <Globo>
              <span className="font-semibold">{c.ciudad}</span>
              <FilaGlobo color="var(--viz-validos)" texto="Válidos" valor={formatearEntero(c.validos)} />
              <FilaGlobo color="var(--viz-rechazados)" texto="Rechazados" valor={formatearEntero(c.rechazados)} />
              <FilaGlobo texto="Calidad" valor={`${formatearNumero(total ? (c.validos / total) * 100 : 0)} %`} />
            </Globo>
          </li>
        )
      })}
    </ul>
  )
}

/** Comparativa entre ciudades de la métrica elegida, de mayor a menor. */
function ComparativaCiudades({ resumenes, metrica }: { resumenes: ReadonlyMap<string, ResumenCiudad>; metrica: Metrica }) {
  const def = METRICAS[metrica]
  const filas = [...resumenes].sort(([, a], [, b]) => def.valor(b) - def.valor(a))
  if (!filas.length) return <p className="text-sm text-muted-foreground">Sin registros válidos todavía.</p>

  // Temperatura: rango mínimo–máximo con la media marcada. Humedad y lluvia: barras desde cero.
  const esRango = metrica === "temperatura"
  const d0 = esRango ? Math.floor(Math.min(...filas.map(([, r]) => r.temperaturaMin))) - 1 : 0
  const d1 = esRango
    ? Math.ceil(Math.max(...filas.map(([, r]) => r.temperaturaMax))) + 1
    : metrica === "humedad"
      ? 100
      : Math.max(1, ...filas.map(([, r]) => def.valor(r)))
  const pct = (v: number) => `${((v - d0) / (d1 - d0)) * 100}%`

  return (
    <div className="flex flex-col gap-1">
      <ul key={metrica} className="flex flex-col gap-0.5">
        {filas.map(([ciudad, r], i) => {
          const v = def.valor(r)
          const retraso = { "--retraso": `${i * 60}ms` } as React.CSSProperties
          return (
            <li
              key={ciudad}
              tabIndex={0}
              aria-label={`${ciudad}: ${def.texto.toLowerCase()} ${formatearNumero(v)} ${def.unidad}`}
              className={CLASE_FILA}
            >
              <span className="truncate text-xs font-medium">{ciudad}</span>
              <span className="relative h-4">
                {esRango ? (
                  <>
                    <span
                      className="crecer-x absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                      style={{ left: pct(r.temperaturaMin), right: `calc(100% - ${pct(r.temperaturaMax)})`, background: "color-mix(in oklch, var(--viz-validos) 35%, transparent)", ...retraso }}
                    />
                    <span
                      className="aparecer absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                      style={{ left: pct(v), background: "var(--viz-validos)", ...retraso }}
                    />
                  </>
                ) : (
                  <span
                    className="crecer-x absolute inset-y-0 left-0 min-w-[2px] rounded-r-[4px]"
                    style={{ width: pct(v), background: "var(--viz-validos)", ...retraso }}
                  />
                )}
              </span>
              <span className="text-right text-xs font-medium tabular-nums">
                {formatearNumero(v)} {def.unidad}
              </span>
              <Globo>
                <span className="font-semibold">{ciudad}</span>
                <FilaGlobo texto="Temperatura media" valor={`${formatearNumero(r.temperaturaMedia)} °C`} />
                <FilaGlobo texto="Mín. / máx." valor={`${formatearNumero(r.temperaturaMin)} / ${formatearNumero(r.temperaturaMax)} °C`} />
                <FilaGlobo texto="Humedad media" valor={`${formatearNumero(r.humedadMedia)} %`} />
                <FilaGlobo texto="Lluvia total" valor={`${formatearNumero(r.precipitacionTotal)} mm`} />
              </Globo>
            </li>
          )
        })}
      </ul>
      {esRango && (
        <p className="flex justify-between pl-[6.5rem] pr-[5.5rem] text-[11px] tabular-nums text-muted-foreground">
          <span>{formatearNumero(d0)} °C</span>
          <span>{formatearNumero(d1)} °C</span>
        </p>
      )}
    </div>
  )
}

const MARGEN = { arriba: 12, derecha: 12, abajo: 24, izquierda: 40 }
const ALTO = 220

function valorDia(d: ResumenDia, m: Metrica): number {
  return m === "temperatura" ? d.temperaturaMedia : m === "humedad" ? d.humedadMedia : d.precipitacionMedia
}

/** Barra vertical con solo las esquinas superiores redondeadas (anclada a la línea base). */
function barraVertical(x: number, y: number, ancho: number, base: number): string {
  const r = Math.min(4, ancho / 2, Math.max(0, base - y))
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${base}Z`
}

/** Evolución día a día de la métrica (media de todas las ciudades), con cruz y tooltip al pasar el ratón. */
function EvolucionDiaria({ dias, metrica }: { dias: ResumenDia[]; metrica: Metrica }) {
  const caja = React.useRef<HTMLDivElement>(null)
  const ancho = useAncho(caja)
  const [sel, setSel] = React.useState<number | null>(null)
  const n = dias.length
  const def = METRICAS[metrica]

  if (!n) {
    return (
      <div ref={caja}>
        <p className="text-sm text-muted-foreground">Sin registros válidos todavía.</p>
      </div>
    )
  }

  const anchoPlot = Math.max(0, ancho - MARGEN.izquierda - MARGEN.derecha)
  const paso = anchoPlot / n
  const cx = (i: number) => MARGEN.izquierda + paso * (i + 0.5)
  const base = ALTO - MARGEN.abajo

  const valores = dias.map((d) => valorDia(d, metrica))
  let d0 = 0
  let d1: number
  if (metrica === "temperatura") {
    const min = Math.min(...dias.map((d) => d.temperaturaMin))
    const max = Math.max(...dias.map((d) => d.temperaturaMax))
    d0 = Math.floor(min - 1)
    d1 = Math.ceil(max + 1)
  } else d1 = metrica === "humedad" ? 100 : Math.max(1, Math.ceil(Math.max(...valores)))
  const y = (v: number) => base - ((v - d0) / (d1 - d0)) * (base - MARGEN.arriba)
  const marcasY = [d0, (d0 + d1) / 2, d1]
  const cadaDias = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(anchoPlot / 52))))

  const linea = valores.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(v).toFixed(1)}`).join("")
  const banda =
    dias.map((d, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(d.temperaturaMax).toFixed(1)}`).join("") +
    dias
      .map((d, i) => ({ d, i }))
      .reverse()
      .map(({ d, i }) => `L${cx(i).toFixed(1)},${y(d.temperaturaMin).toFixed(1)}`)
      .join("") +
    "Z"
  const anchoBarra = Math.max(2, paso - Math.min(10, paso * 0.35))

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setSel(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * n))))
  }
  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setSel((i) => Math.min(n - 1, (i ?? -1) + 1))
    else if (e.key === "ArrowLeft") setSel((i) => Math.max(0, (i ?? n) - 1))
    else if (e.key === "Escape") setSel(null)
    else return
    e.preventDefault()
  }
  const d = sel !== null ? dias[sel] : null

  return (
    <div ref={caja} className="relative w-full">
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          tabIndex={0}
          aria-label={`${def.texto} diaria de todas las ciudades, ${n} días. Usa las flechas para recorrer los días.`}
          onKeyDown={teclado}
          onBlur={() => setSel(null)}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          style={{ fontFamily: "inherit" }}
        >
          {marcasY.map((v) => (
            <g key={v}>
              <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke={v === d0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
              <text x={MARGEN.izquierda - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
                {formatearNumero(v)}
              </text>
            </g>
          ))}
          {dias.map((dia, i) =>
            i % cadaDias === 0 ? (
              <text key={dia.dia} x={cx(i)} y={ALTO - 6} textAnchor="middle" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
                {dia.dia.slice(8, 10)}/{dia.dia.slice(5, 7)}
              </text>
            ) : null
          )}
          {sel !== null && (
            <rect x={cx(sel) - paso / 2} y={MARGEN.arriba} width={paso} height={base - MARGEN.arriba} fill="var(--viz-validos)" opacity={0.08} />
          )}

          <g key={metrica}>
            {metrica === "precipitacion" ? (
              dias.map((dia, i) => (
                <path
                  key={dia.dia}
                  className="crecer-y"
                  style={{ "--retraso": `${i * 25}ms` } as React.CSSProperties}
                  d={barraVertical(cx(i) - anchoBarra / 2, y(dia.precipitacionMedia), anchoBarra, base)}
                  fill="var(--viz-validos)"
                  opacity={sel === null || sel === i ? 1 : 0.55}
                />
              ))
            ) : (
              <>
                {metrica === "temperatura" && n > 1 && (
                  <path className="entrada" d={banda} fill="var(--viz-validos)" opacity={0.16} />
                )}
                {n > 1 && (
                  <path className="trazo" pathLength={1} d={linea} fill="none" stroke="var(--viz-validos)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {valores.map((v, i) => (
                  <circle
                    key={dias[i].dia}
                    className="aparecer"
                    style={{ "--retraso": `${300 + i * 20}ms` } as React.CSSProperties}
                    cx={cx(i)}
                    cy={y(v)}
                    r={sel === i ? 5.5 : 4}
                    fill="var(--viz-validos)"
                    stroke="var(--viz-surface)"
                    strokeWidth={2}
                  />
                ))}
              </>
            )}
          </g>

          <rect
            x={MARGEN.izquierda}
            y={0}
            width={anchoPlot}
            height={base}
            fill="transparent"
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setSel(null)}
          />
        </svg>
      )}

      {d && sel !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 rounded-lg bg-black px-2.5 py-1.5 text-xs text-orange-50 shadow-lg shadow-primary/25"
          style={cx(sel) > ancho / 2 ? { right: ancho - cx(sel) + paso / 2 + 6 } : { left: cx(sel) + paso / 2 + 6 }}
        >
          <p className="font-semibold">
            {d.dia} · {d.ciudades} {d.ciudades === 1 ? "ciudad" : "ciudades"}
          </p>
          <span className="mt-1 flex flex-col gap-0.5">
            <FilaGlobo color="var(--viz-validos)" texto={def.texto} valor={`${formatearNumero(valorDia(d, metrica))} ${def.unidad}`} />
            {metrica === "temperatura" && (
              <FilaGlobo texto="Mín. / máx." valor={`${formatearNumero(d.temperaturaMin)} / ${formatearNumero(d.temperaturaMax)} °C`} />
            )}
          </span>
        </div>
      )}
    </div>
  )
}

const SUBTITULO_DIARIO: Record<Metrica, string> = {
  temperatura: "Media de todas las ciudades; la banda va de la mínima a la máxima del día.",
  humedad: "Humedad relativa media de todas las ciudades.",
  precipitacion: "Lluvia del día dividida entre las ciudades con datos (mm por ciudad).",
}

/** Gráficos de resumen de la extracción: calidad por ciudad, comparativa y evolución diaria. */
export function GraficosExtraccion({ etl }: { etl: PipelineEtl }) {
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const p = etl.procesado
  const validos = p?.limpieza.validos
  const rechazados = p?.limpieza.rechazados
  const resumenes = React.useMemo(() => resumirPorCiudad(validos ?? []), [validos])
  const dias = React.useMemo(() => resumirPorDia(validos ?? []), [validos])
  const conteos = React.useMemo(() => contarPorCiudad(validos ?? [], rechazados ?? []), [validos, rechazados])
  if (!p) return null

  return (
    <section aria-labelledby="titulo-graficos" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-graficos" className="text-base font-semibold">
          Gráficos de la extracción
        </h2>
        <SelectorMetrica valor={metrica} onCambiar={setMetrica} />
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Tarjeta
          titulo="Registros por ciudad"
          subtitulo="Horas que superan la limpieza frente a las rechazadas."
          leyenda={
            <span className="flex gap-3">
              <Muestra color="var(--viz-validos)" texto="Válidos" />
              <Muestra color="var(--viz-rechazados)" texto="Rechazados" />
            </span>
          }
        >
          <RegistrosPorCiudad conteos={conteos} />
        </Tarjeta>
        <Tarjeta
          titulo={`${METRICAS[metrica].texto} por ciudad`}
          subtitulo={metrica === "temperatura" ? "Barra de mínima a máxima; el punto marca la media." : "Ordenadas de mayor a menor."}
          retraso={80}
        >
          <ComparativaCiudades resumenes={resumenes} metrica={metrica} />
        </Tarjeta>
        <Tarjeta titulo={`Evolución diaria · ${NOMBRES[metrica]}`} subtitulo={SUBTITULO_DIARIO[metrica]} retraso={160} className="2xl:col-span-2">
          <EvolucionDiaria dias={dias} metrica={metrica} />
        </Tarjeta>
      </div>
    </section>
  )
}
