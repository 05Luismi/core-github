"use client"

import * as React from "react"
import { CircleAlertIcon, DownloadCloudIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { MAX_DIAS_EXTRACCION, validarPeriodo } from "@/lib/etl/extraccion"
import { formatearDuracion, formatearEntero } from "@/lib/etl/formato"

export function ConfiguracionExtraccion({ etl }: { etl: PipelineEtl }) {
  const [ciudades, setCiudades] = React.useState<string[]>(CIUDADES.map((c) => c.id))
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const [intentado, setIntentado] = React.useState(false)

  const periodo = validarPeriodo(inicio, fin)
  const errores = [
    ...(ciudades.length ? [] : ["Selecciona al menos una ciudad."]),
    ...periodo.errores,
  ]
  const dias = periodo.dias ?? 0
  const bloqueado = etl.extrayendo || etl.cargando

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    if (errores.length || bloqueado) return
    // Se respeta el orden de la lista, no el orden en que se marcaron.
    const orden = CIUDADES.map((c) => c.id).filter((id) => ciudades.includes(id))
    etl.extraer(inicio, fin, orden)
  }

  const procesadas = etl.extracciones.filter(
    (e) => e.estado === "completada" || e.estado === "error"
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configuración de la extracción</CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · horas en UTC · °C, % y mm
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Ciudades</legend>
            <div className="grid grid-cols-2 gap-2">
              {CIUDADES.map((c) => (
                <Label key={c.id} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={ciudades.includes(c.id)}
                    disabled={bloqueado}
                    onCheckedChange={(v) =>
                      setCiudades((prev) =>
                        v ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.nombre}
                </Label>
              ))}
            </div>
            <div className="flex gap-2 text-xs">
              <Button type="button" variant="link" size="xs" className="px-0" disabled={bloqueado} onClick={() => setCiudades(CIUDADES.map((c) => c.id))}>
                Todas
              </Button>
              <Button type="button" variant="link" size="xs" className="px-0" disabled={bloqueado} onClick={() => setCiudades([])}>
                Ninguna
              </Button>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
              <Input id="fecha-inicio" type="date" value={inicio} disabled={bloqueado} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fecha-fin">Fecha final (UTC)</Label>
              <Input id="fecha-fin" type="date" value={fin} disabled={bloqueado} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">Peticiones</dt>
              <dd className="text-lg font-semibold tabular-nums">{ciudades.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Días</dt>
              <dd className="text-lg font-semibold tabular-nums">{dias || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Registros previstos</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {dias ? formatearEntero(ciudades.length * dias * 24) : "—"}
              </dd>
            </div>
          </dl>
          <p className="-mt-2 text-xs text-muted-foreground">
            {ciudades.length} ciudades × {dias || "?"} días × 24 horas. Máximo {MAX_DIAS_EXTRACCION} días por extracción.
          </p>

          {(intentado || periodo.errores.length > 0) && errores.length > 0 && (
            <Alert variant="destructive">
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
            <Alert key={a}>
              <TriangleAlertIcon />
              <AlertDescription>{a}</AlertDescription>
            </Alert>
          ))}

          <Button type="submit" size="lg" disabled={bloqueado}>
            <DownloadCloudIcon data-icon="inline-start" />
            {etl.extrayendo ? "Extrayendo…" : "Extraer datos"}
          </Button>
          {etl.extracciones.length > 0 && etl.procesado && !etl.extrayendo && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Una nueva extracción sustituye a la actual y vacía la selección.
            </p>
          )}
        </form>

        {etl.extracciones.length > 0 && (
          <section aria-label="Estado de la extracción por ciudad" className="mt-5 flex flex-col gap-2">
            <h3 className="text-sm font-medium" aria-live="polite">
              Ciudades procesadas: {procesadas} de {etl.extracciones.length}
              {etl.sesion && (
                <span className="font-normal text-muted-foreground">
                  {" "}· {etl.sesion.inicio} a {etl.sesion.fin}
                </span>
              )}
            </h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {etl.extracciones.map((e) => (
                <li key={e.ciudadId} className="flex flex-col gap-1 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.nombre}</span>
                    <EstadoFaseBadge
                      estado={e.estado}
                      texto={e.estado === "completada" ? "Descargada" : e.estado === "error" ? "Error" : undefined}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {e.filas !== null ? `${formatearEntero(e.filas)} horas` : "—"} ·{" "}
                      {formatearDuracion(e.duracionMs)}
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
