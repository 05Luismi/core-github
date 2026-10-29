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
    <div role="radiogroup" aria-label="Métrica de las gráficas" className="flex rounded-xl bg-panel p-1 shadow-md shadow-primary/15 ring-1 ring-primary/25">
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
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95",
              activa ? "bg-primary text-primary-foreground shadow-md shadow-primary/40" : "text-panel-foreground/70 hover:bg-primary/15 hover:text-panel-foreground"
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

/** Tarjeta HUD: título técnico, línea luminosa y, opcionalmente, inclinación 3D con el puntero. */
function Tarjeta({
  titulo,
  subtitulo,
  leyenda,
  retraso = 0,
  inclinable = true,
  className,
  children,
}: {
  titulo: string
  subtitulo: string
  leyenda?: React.ReactNode
  retraso?: number
  inclinable?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <figure
      className={cn(
        "entrada sombra-suave hud-marco foco cristal flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-primary/20",
        inclinable && "inclinable",
        className
      )}
      style={{ "--retraso": `${retraso}ms` } as React.CSSProperties}
    >
      <figcaption className="flex flex-col gap-2">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-3.5 w-1 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
              <span className="hud-etiqueta text-[11px] font-semibold text-foreground">{titulo}</span>
            </span>
            <span className="text-xs text-muted-foreground">{subtitulo}</span>
          </span>
          {leyenda}
        </span>
        <span aria-hidden className="h-px bg-gradient-to-r from-primary/70 via-primary/15 to-transparent" />
      </figcaption>
      {children}
    </figure>
  )
}

function Muestra({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {texto}
    </span>
  )
}

/** Tooltip de un elemento: aparece al pasar el ratón o al enfocarlo con el teclado. */
function Globo({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden min-w-44 -translate-x-1/2 flex-col gap-0.5 rounded-lg border-l-2 border-primary bg-panel px-2.5 py-1.5 text-xs text-panel-foreground shadow-lg shadow-primary/25 group-hover:flex group-focus-visible:flex"
    >
      {children}
    </span>
  )
}

function FilaGlobo({ color, texto, valor }: { color?: string; texto: string; valor: string }) {
  return (
    <span className="flex items-center justify-between gap-3 tabular-nums">
      <span className="flex items-center gap-1.5 text-panel-foreground/70">
        {color && <span className="inline-block size-2 rounded-full" style={{ background: color }} />}
        {texto}
      </span>
      <span className="font-medium">{valor}</span>
    </span>
  )
}

/** Prisma 3D (frente, lateral y tapa) anclado en `y + alto`: la pieza básica de las barras isométricas. */
function Prisma({ x, y, ancho, alto, prof, color }: { x: number; y: number; ancho: number; alto: number; prof: number; color: string }) {
  if (alto <= 0) return null
  const dy = prof * 0.6
  return (
    <>
      <path d={`M${x + ancho},${y}l${prof},${-dy}v${alto}l${-prof},${dy}Z`} style={{ fill: `color-mix(in oklch, ${color} 55%, black)` }} />
      <path d={`M${x},${y}l${prof},${-dy}h${ancho}l${-prof},${dy}Z`} style={{ fill: `color-mix(in oklch, ${color} 72%, white)` }} />
      <rect x={x} y={y} width={ancho} height={alto} style={{ fill: color }} />
    </>
  )
}

/** Anillo grande con el porcentaje de registros que superan la limpieza. */
function CalidadGlobal({ conteos }: { conteos: ConteoCiudad[] }) {
  const validos = conteos.reduce((s, c) => s + c.validos, 0)
  const rechazados = conteos.reduce((s, c) => s + c.rechazados, 0)
  const total = validos + rechazados
  const fraccion = total ? validos / total : 0
  const SEGMENTOS = 48
  const encendidos = Math.round(fraccion * SEGMENTOS)

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 200 200" className="size-48 shrink-0" role="img" aria-label={`Calidad: ${formatearNumero(fraccion * 100)} % de registros válidos`}>
        <circle className="giro" cx="100" cy="100" r="94" fill="none" stroke="var(--viz-validos)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 9" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="var(--viz-grid)" strokeWidth="1" />
        {/* El giro va en el grupo: la animación de entrada del segmento no debe pisar su transformación. */}
        {Array.from({ length: SEGMENTOS }, (_, k) => (
          <g key={k} transform={`rotate(${(k * 360) / SEGMENTOS} 100 100)`}>
            <rect
              className="aparecer"
              style={{ "--retraso": `${k * 18}ms` } as React.CSSProperties}
              x="98.5"
              y="16"
              width="3"
              height="13"
              rx="1"
              fill={k < encendidos ? "var(--viz-validos)" : "var(--viz-rechazados)"}
              opacity={k < encendidos ? 1 : 0.55}
            />
          </g>
        ))}
        <circle className="giro-inverso" cx="100" cy="100" r="62" fill="none" stroke="var(--viz-validos)" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 4" />
        <circle
          className="arco neon"
          cx="100"
          cy="100"
          r="55"
          fill="none"
          stroke="var(--viz-validos)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${fraccion * 100} 100`}
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="98" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--viz-ink)" className="tabular-nums">
          {formatearNumero(fraccion * 100)}%
        </text>
        <text x="100" y="120" textAnchor="middle" fontSize="9" letterSpacing="3" fill="var(--viz-muted)" style={{ fontFamily: "var(--font-mono)" }}>
          CALIDAD
        </text>
      </svg>
      <dl className="grid min-w-36 grid-cols-1 gap-2">
        {[
          { texto: "Válidos", valor: validos, color: "var(--viz-validos)" },
          { texto: "Rechazados", valor: rechazados, color: "var(--viz-rechazados)" },
          { texto: "Ciudades", valor: conteos.length, color: "var(--viz-muted)" },
        ].map((f) => (
          <div key={f.texto} className="rounded-lg border-l-2 bg-primary/5 px-3 py-1.5" style={{ borderColor: f.color }}>
            <dt className="hud-etiqueta text-muted-foreground">{f.texto}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatearEntero(f.valor)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const ALTO_BARRAS = 250
const MAX_BLOQUES = 10
const HUECO_BLOQUE = 2

/** Registros por bloque: un número redondo (1, 2, 5 × 10ⁿ) para que la torre más alta tenga como mucho 10 bloques. */
function unidadBloque(max: number): number {
  const bruto = Math.max(1, max / MAX_BLOQUES)
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  return ([1, 2, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia
}

/** Torre de bloques 3D apilados desde `base`; el último bloque puede ser parcial. Caen uno tras otro. */
function Bloques({
  x,
  base,
  valor,
  unidad,
  escala,
  ancho,
  prof,
  color,
  retraso,
}: {
  x: number
  base: number
  valor: number
  unidad: number
  escala: (v: number) => number
  ancho: number
  prof: number
  color: string
  retraso: number
}) {
  const piezas: number[] = []
  for (let resto = valor; resto > 0; resto -= unidad) piezas.push(Math.min(unidad, resto))
  let y = base
  return (
    <>
      {piezas.map((p, k) => {
        const alto = Math.max(1, escala(p) - HUECO_BLOQUE)
        y -= alto + HUECO_BLOQUE
        return (
          <g key={k} className="entrada" style={{ "--retraso": `${retraso + k * 60}ms` } as React.CSSProperties}>
            <Prisma x={x} y={y + HUECO_BLOQUE} ancho={ancho} alto={alto} prof={prof} color={color} />
          </g>
        )
      })}
    </>
  )
}

/** Barras 3D isométricas apiladas: válidos y rechazados por ciudad, sobre un suelo en perspectiva. */
function RegistrosPorCiudad({ conteos }: { conteos: ConteoCiudad[] }) {
  const caja = React.useRef<HTMLDivElement>(null)
  const ancho = useAncho(caja)
  const [sel, setSel] = React.useState<number | null>(null)
  const n = conteos.length

  if (!n) {
    return (
      <div ref={caja}>
        <p className="text-sm text-muted-foreground">Sin registros todavía.</p>
      </div>
    )
  }

  const m = { arriba: 26, abajo: 30, izquierda: 8, derecha: 8 }
  const paso = Math.max(0, ancho - m.izquierda - m.derecha) / n
  const anchoBarra = Math.max(6, Math.min(44, paso * 0.48))
  const prof = Math.min(16, anchoBarra * 0.45)
  const dy = prof * 0.6
  const base = ALTO_BARRAS - m.abajo
  const max = Math.max(1, ...conteos.map((c) => c.validos + c.rechazados))
  const escala = (v: number) => (v / max) * (base - m.arriba - dy - 14)
  const xBarra = (i: number) => m.izquierda + paso * i + (paso - anchoBarra - prof) / 2
  const unidad = unidadBloque(max)
  const corto = paso < 64

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setSel((i) => Math.min(n - 1, (i ?? -1) + 1))
    else if (e.key === "ArrowLeft") setSel((i) => Math.max(0, (i ?? n) - 1))
    else if (e.key === "Escape") setSel(null)
    else return
    e.preventDefault()
  }
  const c = sel !== null ? conteos[sel] : null

  return (
    <div ref={caja} className="relative w-full overflow-hidden rounded-lg">
      <div aria-hidden className="suelo-3d" />
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO_BARRAS}
          role="img"
          tabIndex={0}
          aria-label={`Registros válidos y rechazados de ${n} ciudades. Usa las flechas para recorrerlas.`}
          onKeyDown={teclado}
          onBlur={() => setSel(null)}
          className="relative rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          style={{ fontFamily: "inherit" }}
        >
          {/* Pared del fondo con tres marcas de escala. */}
          {[0.5, 1].map((f) => {
            const yy = base - dy - escala(max * f)
            return (
              <g key={f}>
                <line x1={m.izquierda + prof} x2={ancho - m.derecha} y1={yy} y2={yy} stroke="var(--viz-grid)" strokeDasharray="3 4" />
                <text x={ancho - m.derecha} y={yy - 4} textAnchor="end" fontSize={10} fill="var(--viz-muted)" className="tabular-nums">
                  {formatearEntero(max * f)}
                </text>
              </g>
            )
          })}
          {/* Suelo: paralelogramo bajo las barras. */}
          <path
            d={`M${m.izquierda},${base}L${ancho - m.derecha - prof},${base}l${prof},${-dy}L${m.izquierda + prof},${base - dy}Z`}
            fill="var(--viz-validos)"
            opacity={0.08}
            stroke="var(--viz-axis)"
          />
          {conteos.map((cc, i) => {
            const hv = escala(cc.validos)
            const hr = escala(cc.rechazados)
            const x = xBarra(i)
            const activa = sel === i
            return (
              <g key={cc.ciudad} opacity={sel === null || activa ? 1 : 0.45} className={cn("transition-opacity", activa && "neon")}>
                <Bloques x={x} base={base} valor={cc.validos} unidad={unidad} escala={escala} ancho={anchoBarra} prof={prof} color="var(--viz-validos)" retraso={i * 90} />
                <Bloques x={x} base={base - hv} valor={cc.rechazados} unidad={unidad} escala={escala} ancho={anchoBarra} prof={prof} color="var(--viz-rechazados)" retraso={i * 90 + 400} />
                <text
                  x={x + anchoBarra / 2 + prof / 2}
                  y={base - hv - hr - dy - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--viz-ink)"
                  className="aparecer tabular-nums"
                  style={{ "--retraso": `${400 + i * 70}ms` } as React.CSSProperties}
                >
                  {formatearEntero(cc.validos)}
                </text>
                <text x={x + anchoBarra / 2} y={base + 18} textAnchor="middle" fontSize={corto ? 9 : 11} fill={activa ? "var(--viz-ink)" : "var(--viz-muted)"}>
                  {corto ? cc.ciudad.slice(0, 3).toUpperCase() : cc.ciudad}
                </text>
                <rect
                  x={m.izquierda + paso * i}
                  y={0}
                  width={paso}
                  height={ALTO_BARRAS}
                  fill="transparent"
                  onPointerEnter={() => setSel(i)}
                  onPointerLeave={() => setSel(null)}
                  onPointerDown={() => setSel(i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {c && sel !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 flex min-w-44 flex-col gap-0.5 rounded-lg border-l-2 border-primary bg-panel px-2.5 py-1.5 text-xs text-panel-foreground shadow-lg shadow-primary/25"
          style={xBarra(sel) > ancho / 2 ? { right: ancho - xBarra(sel) + 8 } : { left: xBarra(sel) + anchoBarra + prof + 8 }}
        >
          <span className="font-semibold">{c.ciudad}</span>
          <FilaGlobo color="var(--viz-validos)" texto="Válidos" valor={formatearEntero(c.validos)} />
          <FilaGlobo color="var(--viz-rechazados)" texto="Rechazados" valor={formatearEntero(c.rechazados)} />
          <FilaGlobo
            texto="Calidad"
            valor={`${formatearNumero(c.validos + c.rechazados ? (c.validos / (c.validos + c.rechazados)) * 100 : 0)} %`}
          />
        </div>
      )}
    </div>
  )
}

/** Medidor circular de una ciudad: arco con la métrica y, en temperatura, un arco exterior con el rango. */
function Medidor({
  fraccion,
  rango,
  valor,
  unidad,
  indice,
}: {
  fraccion: number
  rango?: [number, number]
  valor: number
  unidad: string
  indice: number
}) {
  const f = Math.min(1, Math.max(0, fraccion))
  const retraso = { "--retraso": `${indice * 80}ms` } as React.CSSProperties
  return (
    <svg viewBox="0 0 100 100" className="size-24" aria-hidden>
      <circle className="giro" cx="50" cy="50" r="47" fill="none" stroke="var(--viz-validos)" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--viz-grid)" strokeWidth="7" pathLength={100} strokeDasharray="0.9 1.6" />
      {rango && (
        <circle
          className="arco"
          style={retraso}
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--viz-validos)"
          strokeOpacity="0.5"
          strokeWidth="2"
          pathLength={100}
          strokeDasharray={`${Math.max(0.5, (rango[1] - rango[0]) * 100)} 100`}
          strokeDashoffset={-rango[0] * 100}
          transform="rotate(-90 50 50)"
        />
      )}
      <circle
        className="arco neon"
        style={retraso}
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="var(--viz-validos)"
        strokeWidth="7"
        pathLength={100}
        strokeDasharray={`${f * 100} 100`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="52" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--viz-ink)" className="tabular-nums">
        {formatearNumero(valor)}
      </text>
      <text x="50" y="66" textAnchor="middle" fontSize="8" fill="var(--viz-muted)">
        {unidad}
      </text>
    </svg>
  )
}

/** Comparativa entre ciudades de la métrica elegida con medidores circulares, de mayor a menor. */
function ComparativaCiudades({ resumenes, metrica }: { resumenes: ReadonlyMap<string, ResumenCiudad>; metrica: Metrica }) {
  const def = METRICAS[metrica]
  const filas = [...resumenes].sort(([, a], [, b]) => def.valor(b) - def.valor(a))
  if (!filas.length) return <p className="text-sm text-muted-foreground">Sin registros válidos todavía.</p>

  // Temperatura: escala común entre la mínima y la máxima de todas las ciudades. Humedad: 0–100. Lluvia: 0–máximo.
  const esRango = metrica === "temperatura"
  const d0 = esRango ? Math.floor(Math.min(...filas.map(([, r]) => r.temperaturaMin))) - 1 : 0
  const d1 = esRango
    ? Math.ceil(Math.max(...filas.map(([, r]) => r.temperaturaMax))) + 1
    : metrica === "humedad"
      ? 100
      : Math.max(1, ...filas.map(([, r]) => def.valor(r)))
  const frac = (v: number) => (v - d0) / (d1 - d0)

  return (
    <div className="flex flex-col gap-2">
      <ul key={metrica} className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
        {filas.map(([ciudad, r], i) => {
          const v = def.valor(r)
          return (
            <li
              key={ciudad}
              tabIndex={0}
              aria-label={`${ciudad}: ${def.texto.toLowerCase()} ${formatearNumero(v)} ${def.unidad}`}
              className="group relative flex flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
            >
              <Medidor
                fraccion={frac(v)}
                rango={esRango ? [frac(r.temperaturaMin), frac(r.temperaturaMax)] : undefined}
                valor={v}
                unidad={def.unidad}
                indice={i}
              />
              <span className="hud-etiqueta max-w-full truncate px-1 text-foreground">{ciudad}</span>
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
      <p className="hud-etiqueta text-muted-foreground tabular-nums">
        Escala {formatearNumero(d0)}–{formatearNumero(d1)} {def.unidad}
        {esRango && " · arco exterior: mínima a máxima"}
      </p>
    </div>
  )
}

const PROF = 12
const MARGEN = { arriba: 12 + PROF, derecha: 12 + PROF, abajo: 24, izquierda: 40 }
const ALTO = 240

function valorDia(d: ResumenDia, m: Metrica): number {
  return m === "temperatura" ? d.temperaturaMedia : m === "humedad" ? d.humedadMedia : d.precipitacionMedia
}

/** Evolución día a día de la métrica (media de todas las ciudades) como cinta 3D, con cruz y tooltip al pasar el ratón. */
function EvolucionDiaria({ dias, metrica }: { dias: ResumenDia[]; metrica: Metrica }) {
  const caja = React.useRef<HTMLDivElement>(null)
  const ancho = useAncho(caja)
  const [sel, setSel] = React.useState<number | null>(null)
  const idGradiente = React.useId()
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
  const dx = PROF
  const dy = PROF * 0.6

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

  const trazo = (desX: number, desY: number) =>
    valores.map((v, i) => `${i ? "L" : "M"}${(cx(i) + desX).toFixed(1)},${(y(v) + desY).toFixed(1)}`).join("")
  const linea = trazo(0, 0)
  const area = `${linea}L${cx(n - 1).toFixed(1)},${base}L${cx(0).toFixed(1)},${base}Z`
  const banda =
    dias.map((d, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(d.temperaturaMax).toFixed(1)}`).join("") +
    dias
      .map((d, i) => ({ d, i }))
      .reverse()
      .map(({ d, i }) => `L${cx(i).toFixed(1)},${y(d.temperaturaMin).toFixed(1)}`)
      .join("") +
    "Z"
  const anchoBarra = Math.max(2, paso - Math.min(10, paso * 0.35) - Math.min(8, paso * 0.3))
  const profBarra = Math.min(10, anchoBarra * 0.4)

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
    <div ref={caja} className="relative w-full overflow-hidden rounded-lg">
      <div aria-hidden className="suelo-3d" />
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          tabIndex={0}
          aria-label={`${def.texto} diaria de todas las ciudades, ${n} días. Usa las flechas para recorrer los días.`}
          onKeyDown={teclado}
          onBlur={() => setSel(null)}
          className="relative rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          style={{ fontFamily: "inherit" }}
        >
          <defs>
            <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-validos)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--viz-validos)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {marcasY.map((v) => (
            <g key={v}>
              <line x1={MARGEN.izquierda + dx} x2={ancho - MARGEN.derecha + dx} y1={y(v) - dy} y2={y(v) - dy} stroke="var(--viz-grid)" strokeDasharray="3 4" />
              <line x1={MARGEN.izquierda} x2={MARGEN.izquierda + dx} y1={y(v)} y2={y(v) - dy} stroke="var(--viz-grid)" />
              <text x={MARGEN.izquierda - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
                {formatearNumero(v)}
              </text>
            </g>
          ))}
          <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={base} y2={base} stroke="var(--viz-axis)" />
          {dias.map((dia, i) =>
            i % cadaDias === 0 ? (
              <text key={dia.dia} x={cx(i)} y={ALTO - 6} textAnchor="middle" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
                {dia.dia.slice(8, 10)}/{dia.dia.slice(5, 7)}
              </text>
            ) : null
          )}
          {sel !== null && (
            <>
              <rect x={cx(sel) - paso / 2} y={MARGEN.arriba - dy} width={paso} height={base - MARGEN.arriba + dy} fill="var(--viz-validos)" opacity={0.08} />
              <line x1={cx(sel)} x2={cx(sel)} y1={MARGEN.arriba - dy} y2={base} stroke="var(--viz-validos)" strokeDasharray="2 3" opacity={0.8} />
            </>
          )}

          <g key={metrica}>
            {metrica === "precipitacion" ? (
              dias.map((dia, i) => {
                const yy = y(dia.precipitacionMedia)
                return (
                  <g
                    key={dia.dia}
                    className="crecer-y"
                    style={{ "--retraso": `${i * 25}ms` } as React.CSSProperties}
                    opacity={sel === null || sel === i ? 1 : 0.5}
                  >
                    <Prisma x={cx(i) - anchoBarra / 2} y={yy} ancho={anchoBarra} alto={base - yy} prof={profBarra} color="var(--viz-validos)" />
                  </g>
                )
              })
            ) : (
              <>
                {metrica === "temperatura" && n > 1 && (
                  <path className="entrada" d={banda} fill="var(--viz-validos)" fillOpacity={0.07} stroke="var(--viz-validos)" strokeOpacity={0.4} strokeDasharray="3 3" />
                )}
                {n > 1 && (
                  <g className="entrada">
                    <path d={area} fill={`url(#${idGradiente})`} />
                    {/* Caras laterales de la cinta: unen la línea frontal con su copia desplazada hacia el fondo. */}
                    {valores.slice(1).map((v, k) => {
                      const a = valores[k]
                      return (
                        <path
                          key={k}
                          d={`M${cx(k)},${y(a)}L${cx(k + 1)},${y(v)}l${dx},${-dy}L${cx(k) + dx},${y(a) - dy}Z`}
                          fill="var(--viz-validos)"
                          opacity={v >= a ? 0.28 : 0.16}
                        />
                      )
                    })}
                    <path d={trazo(dx, -dy)} fill="none" stroke="var(--viz-validos)" strokeOpacity={0.45} strokeWidth={1} strokeLinejoin="round" />
                  </g>
                )}
                {n > 1 && (
                  <path className="trazo neon" pathLength={1} d={linea} fill="none" stroke="var(--viz-validos)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {valores.map((v, i) => (
                  <g key={dias[i].dia} className="aparecer" style={{ "--retraso": `${300 + i * 20}ms` } as React.CSSProperties}>
                    <line x1={cx(i)} x2={cx(i)} y1={y(v)} y2={base} stroke="var(--viz-validos)" strokeOpacity={sel === i ? 0.7 : 0.18} />
                    <rect
                      x={cx(i) - (sel === i ? 5 : 3.5)}
                      y={y(v) - (sel === i ? 5 : 3.5)}
                      width={sel === i ? 10 : 7}
                      height={sel === i ? 10 : 7}
                      transform={`rotate(45 ${cx(i)} ${y(v)})`}
                      fill="var(--viz-surface)"
                      stroke="var(--viz-validos)"
                      strokeWidth={2}
                    />
                  </g>
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
          className="pointer-events-none absolute top-0 z-10 rounded-lg border-l-2 border-primary bg-panel px-2.5 py-1.5 text-xs text-panel-foreground shadow-lg shadow-primary/25"
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

/** Gráficos de resumen de la extracción: calidad global, registros por ciudad, comparativa y evolución diaria. */
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
        <h2 id="titulo-graficos" className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden className="parpadeo size-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
          Gráficos de la extracción
        </h2>
        <SelectorMetrica valor={metrica} onCambiar={setMetrica} />
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Tarjeta titulo="Calidad global" subtitulo="Proporción de horas que superan la limpieza.">
          <CalidadGlobal conteos={conteos} />
        </Tarjeta>
        <Tarjeta
          titulo="Registros por ciudad"
          subtitulo={`Torres de bloques 3D: cada bloque son ${formatearEntero(unidadBloque(Math.max(1, ...conteos.map((c) => c.validos + c.rechazados))))} registros.`}
          retraso={80}
          inclinable={false}
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
          subtitulo={metrica === "temperatura" ? "Arco interior: media. Arco exterior: de la mínima a la máxima." : "Ordenadas de mayor a menor."}
          retraso={160}
          inclinable={false}
          className="2xl:col-span-2"
        >
          <ComparativaCiudades resumenes={resumenes} metrica={metrica} />
        </Tarjeta>
        <Tarjeta
          titulo={`Evolución diaria · ${NOMBRES[metrica]}`}
          subtitulo={SUBTITULO_DIARIO[metrica]}
          retraso={240}
          inclinable={false}
          className="2xl:col-span-2"
        >
          <EvolucionDiaria dias={dias} metrica={metrica} />
        </Tarjeta>
      </div>
    </section>
  )
}
