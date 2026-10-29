"use client"

import * as React from "react"
import {
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  DownloadCloudIcon,
  LoaderCircleIcon,
  MapPinIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { cn } from "cn"

import { extraerEjemplo } from "@/components/etl/bienvenida"
import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { useNumeroAnimado } from "@/hooks/use-numero-animado"
import { CIUDADES } from "@/lib/etl/ciudades"
import { DIAS_RETRASO_ARCHIVO, diasIncluidos, hoyUtcIso, MAX_DIAS_EXTRACCION, validarPeriodo } from "@/lib/etl/extraccion"
import { formatearDuracion, formatearEntero } from "@/lib/etl/formato"

const MS_DIA = 86_400_000

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10)
}

/** Atajos de periodo que terminan en el último día ya publicado por el archivo (sin avisos de retraso). */
function atajosPeriodo(ahora = new Date()) {
  const ultimo = sumarDias(hoyUtcIso(ahora), -DIAS_RETRASO_ARCHIVO)
  const primeroMes = `${hoyUtcIso(ahora).slice(0, 7)}-01`
  const finMesAnterior = sumarDias(primeroMes, -1)
  return [
    { texto: "Últimos 3 días", inicio: sumarDias(ultimo, -2), fin: ultimo },
    { texto: "Última semana", inicio: sumarDias(ultimo, -6), fin: ultimo },
    { texto: "Últimas 2 semanas", inicio: sumarDias(ultimo, -13), fin: ultimo },
    { texto: "Mes anterior", inicio: `${finMesAnterior.slice(0, 7)}-01`, fin: finMesAnterior },
  ]
}

/** Bloque numerado del formulario; el número pasa a un check cuando el paso es válido. */
function Paso({
  n,
  titulo,
  icono: Icono,
  listo,
  extra,
  retraso,
  children,
}: {
  n: number
  titulo: string
  icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  listo: boolean
  extra?: React.ReactNode
  retraso: number
  children: React.ReactNode
}) {
  return (
    <div className="entrada flex flex-col gap-2.5" style={{ "--retraso": `${retraso}ms` } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
            listo ? "bg-primary text-primary-foreground shadow-md shadow-primary/40" : "bg-panel text-primary"
          )}
        >
          {listo ? <CheckIcon aria-label="completado" className="aparecer size-3.5" /> : n}
        </span>
        <Icono aria-hidden className="size-4 text-primary-strong" />
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="ml-auto">{extra}</span>
      </div>
      {children}
    </div>
  )
}

function Ficha({
  activa,
  disabled,
  onClick,
  children,
}: {
  activa: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm font-medium transition-all duration-200 select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-0.5",
        activa
          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/35"
          : "border-border bg-background hover:border-primary/60 hover:shadow-md hover:shadow-primary/15"
      )}
    >
      {children}
    </button>
  )
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  const animado = useNumeroAnimado(valor ?? 0)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="text-[11px] tracking-wide text-panel-foreground/60 uppercase">{etiqueta}</dt>
      <dd className="text-xl font-bold text-primary tabular-nums">{valor === null ? "—" : formatearEntero(animado)}</dd>
    </div>
  )
}

/** Tira de 31 casillas: los días elegidos se encienden en naranja, uno tras otro. */
function TiraDias({ dias, inicio }: { dias: number; inicio: string }) {
  const encendidos = Math.min(dias, MAX_DIAS_EXTRACCION)
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className="grid grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
        {Array.from({ length: MAX_DIAS_EXTRACCION }, (_, i) => {
          const on = i < encendidos
          return (
            <span
              key={on ? `on-${i}-${inicio}` : `off-${i}`}
              title={on ? sumarDias(inicio, i) : undefined}
              className={cn("h-5 rounded-[3px] transition-colors", on ? "aparecer bg-primary shadow-sm shadow-primary/40" : "bg-muted")}
              style={on ? ({ "--retraso": `${i * 15}ms` } as React.CSSProperties) : undefined}
            />
          )
        })}
      </div>
      <p className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{dias ? `${dias} de ${MAX_DIAS_EXTRACCION} días` : "Periodo no válido"}</span>
        <span>Máximo {MAX_DIAS_EXTRACCION}</span>
      </p>
    </div>
  )
}

export function ConfiguracionExtraccion({ etl }: { etl: PipelineEtl }) {
  const [ciudades, setCiudades] = React.useState<string[]>(CIUDADES.map((c) => c.id))
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const [intentado, setIntentado] = React.useState(false)

  // Si la extracción se lanza desde fuera (p. ej. el ejemplo), el formulario refleja lo que se pidió.
  const [sesionPrevia, setSesionPrevia] = React.useState(etl.sesion)
  if (etl.sesion !== sesionPrevia) {
    setSesionPrevia(etl.sesion)
    if (etl.sesion) {
      setCiudades(etl.sesion.ciudadIds)
      setInicio(etl.sesion.inicio)
      setFin(etl.sesion.fin)
    }
  }

  const periodo = validarPeriodo(inicio, fin)
  const errores = [...(ciudades.length ? [] : ["Selecciona al menos una ciudad."]), ...periodo.errores]
  const dias = periodo.dias ?? 0
  const bloqueado = etl.extrayendo || etl.cargando
  const atajos = atajosPeriodo()

  const alternar = (id: string) => setCiudades((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    if (errores.length || bloqueado) return
    // Se respeta el orden de la lista, no el orden en que se marcaron.
    const orden = CIUDADES.map((c) => c.id).filter((id) => ciudades.includes(id))
    etl.extraer(inicio, fin, orden)
  }

  const procesadas = etl.extracciones.filter((e) => e.estado === "completada" || e.estado === "error").length
  const horasEsperadas = etl.sesion ? (diasIncluidos(etl.sesion.inicio, etl.sesion.fin) ?? 0) * 24 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel text-primary shadow-md shadow-primary/25">
            <SlidersHorizontalIcon aria-hidden className="size-4.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <CardTitle className="font-semibold">Configuración de la extracción</CardTitle>
            <CardDescription>API histórica de Open-Meteo · horas en UTC · °C, % y mm</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <Paso
            n={1}
            titulo="Ciudades"
            icono={MapPinIcon}
            listo={ciudades.length > 0}
            retraso={0}
            extra={
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-strong tabular-nums">
                {ciudades.length} de {CIUDADES.length}
              </span>
            }
          >
            <div role="group" aria-label="Ciudades a extraer" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-2">
              {CIUDADES.map((c) => {
                const activa = ciudades.includes(c.id)
                return (
                  <Ficha key={c.id} activa={activa} disabled={bloqueado} onClick={() => alternar(c.id)}>
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                        activa ? "border-panel bg-panel text-primary" : "border-primary/40 group-hover:border-primary"
                      )}
                    >
                      {activa && <CheckIcon aria-hidden className="aparecer size-3" />}
                    </span>
                    <span className="truncate">{c.nombre}</span>
                  </Ficha>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { texto: "Todas", accion: () => setCiudades(CIUDADES.map((c) => c.id)) },
                { texto: "Ninguna", accion: () => setCiudades([]) },
                { texto: "Invertir", accion: () => setCiudades((prev) => CIUDADES.map((c) => c.id).filter((id) => !prev.includes(id))) },
              ].map((a) => (
                <Button key={a.texto} type="button" variant="outline" size="xs" className="rounded-full hover:border-primary/60" disabled={bloqueado} onClick={a.accion}>
                  {a.texto}
                </Button>
              ))}
            </div>
          </Paso>

          <Paso n={2} titulo="Periodo" icono={CalendarRangeIcon} listo={periodo.errores.length === 0} retraso={80}>
            <div className="flex flex-wrap gap-1.5">
              {atajos.map((a) => {
                const activo = a.inicio === inicio && a.fin === fin
                return (
                  <Ficha
                    key={a.texto}
                    activa={activo}
                    disabled={bloqueado}
                    onClick={() => {
                      setInicio(a.inicio)
                      setFin(a.fin)
                    }}
                  >
                    <span className="text-xs">{a.texto}</span>
                  </Ficha>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="fecha-inicio" className="text-xs">
                  Desde (UTC)
                </Label>
                <Input id="fecha-inicio" type="date" value={inicio} disabled={bloqueado} onChange={(e) => setInicio(e.target.value)} className="transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/20" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="fecha-fin" className="text-xs">
                  Hasta (UTC)
                </Label>
                <Input id="fecha-fin" type="date" value={fin} disabled={bloqueado} onChange={(e) => setFin(e.target.value)} className="transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/20" />
              </div>
            </div>
            <TiraDias dias={dias} inicio={inicio} />
          </Paso>

          <Paso n={3} titulo="Resumen" icono={DownloadCloudIcon} listo={errores.length === 0} retraso={160}>
            <dl className="grid grid-cols-3 gap-2 rounded-xl bg-panel p-3 text-center shadow-lg shadow-primary/20">
              <Cifra etiqueta="Peticiones" valor={ciudades.length} />
              <Cifra etiqueta="Días" valor={dias || null} />
              <Cifra etiqueta="Registros" valor={dias ? ciudades.length * dias * 24 : null} />
            </dl>
            <p className="-mt-1 text-xs text-muted-foreground">
              {ciudades.length} ciudades × {dias || "?"} días × 24 horas.
            </p>
          </Paso>

          {(intentado || periodo.errores.length > 0) && errores.length > 0 && (
            <Alert variant="destructive" className="entrada">
              <CircleAlertIcon />
              <AlertTitle>Revisa la configuración</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {periodo.avisos.map((a) => (
            <Alert key={a} className="entrada">
              <TriangleAlertIcon />
              <AlertDescription>{a}</AlertDescription>
            </Alert>
          ))}

          <Button type="submit" size="lg" disabled={bloqueado} className={cn("h-11 text-base", etl.extrayendo && "brillo")}>
            {etl.extrayendo ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <DownloadCloudIcon data-icon="inline-start" />}
            {etl.extrayendo ? "Extrayendo…" : "Extraer datos"}
          </Button>
          {etl.extracciones.length === 0 && (
            <Button type="button" variant="link" size="sm" className="-mt-3 self-center" disabled={bloqueado} onClick={() => extraerEjemplo(etl)}>
              <SparklesIcon data-icon="inline-start" />
              ¿Sin ideas? Prueba con un ejemplo
            </Button>
          )}
          {etl.extracciones.length > 0 && etl.procesado && !etl.extrayendo && (
            <p className="-mt-3 text-xs text-muted-foreground">Una nueva extracción sustituye a la actual y vacía la selección.</p>
          )}
        </form>

        {etl.extracciones.length > 0 && (
          <section aria-label="Estado de la extracción por ciudad" className="mt-5 flex flex-col gap-2">
            <h3 className="text-sm font-semibold" aria-live="polite">
              Ciudades procesadas: {procesadas} de {etl.extracciones.length}
              {etl.sesion && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {etl.sesion.inicio} a {etl.sesion.fin}
                </span>
              )}
            </h3>
            <Progress value={Math.round((procesadas / etl.extracciones.length) * 100)} aria-label="Progreso de la extracción" />
            <ul className="flex flex-col gap-1.5">
              {etl.extracciones.map((e, i) => (
                <li
                  key={e.ciudadId}
                  className="entrada flex flex-col gap-1.5 rounded-lg bg-background p-2.5 ring-1 ring-primary/15 transition-shadow hover:shadow-md hover:shadow-primary/15"
                  style={{ "--retraso": `${i * 50}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.nombre}</span>
                    <EstadoFaseBadge estado={e.estado} texto={e.estado === "completada" ? "Descargada" : e.estado === "error" ? "Error" : undefined} />
                  </div>
                  {horasEsperadas > 0 && (
                    <span aria-hidden className="h-1 overflow-hidden rounded-full bg-primary/15">
                      <span
                        className={cn("block h-full rounded-full transition-[width] duration-700", e.estado === "error" ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${e.estado === "error" ? 100 : Math.min(100, ((e.filas ?? 0) / horasEsperadas) * 100)}%` }}
                      />
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {e.filas !== null ? `${formatearEntero(e.filas)} horas` : "—"} · {formatearDuracion(e.duracionMs)}
                    </span>
                    {e.estado === "error" && (
                      <Button size="xs" variant="outline" disabled={bloqueado} onClick={() => etl.reintentarCiudad(e.ciudadId)}>
                        <RotateCwIcon data-icon="inline-start" />
                        Reintentar {e.nombre}
                      </Button>
                    )}
                  </div>
                  {e.error && <p className="text-xs text-destructive">{e.error}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
