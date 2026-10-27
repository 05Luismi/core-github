"use client"

import * as React from "react"
import { CircleAlertIcon, DatabaseIcon, RefreshCwIcon } from "lucide-react"

import { claseSelect } from "@/components/etl/pestana-validos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatearEntero, formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"

type Fila = {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

type Consulta = {
  ciudad: string
  desde: string
  hasta: string
  orden: string
  direccion: "asc" | "desc"
  pagina: number
  tamano: number
}

type Resultado =
  | { version: number; ok: true; filas: Fila[]; total: number; leidoEn: string }
  | { version: number; ok: false; error: string }

const CONSULTA_INICIAL: Consulta = {
  ciudad: "",
  desde: "",
  hasta: "",
  orden: "fecha_hora",
  direccion: "asc",
  pagina: 1,
  tamano: 25,
}

const ORDENES = [
  ["ciudad", "Ciudad"],
  ["fecha_hora", "Fecha y hora"],
  ["temperatura_c", "Temperatura"],
  ["humedad_pct", "Humedad"],
  ["precipitacion_mm", "Precipitación"],
  ["importado_en", "Importado en"],
]

export function PestanaSupabase({ etl }: { etl: PipelineEtl }) {
  const [borrador, setBorrador] = React.useState(CONSULTA_INICIAL)
  const [peticion, setPeticion] = React.useState({ consulta: CONSULTA_INICIAL, version: 1 })
  const [resultado, setResultado] = React.useState<Resultado | null>(null)
  const cargando = resultado?.version !== peticion.version

  React.useEffect(() => {
    const { consulta, version } = peticion
    const params = new URLSearchParams(
      Object.entries(consulta).map(([k, v]) => [k, String(v)])
    )
    const control = new AbortController()
    fetch(`/api/supabase/datos?${params}`, { cache: "no-store", signal: control.signal })
      .then(async (r) => {
        const d = await r.json()
        setResultado(
          d.ok
            ? { version, ok: true, filas: d.filas, total: d.total, leidoEn: new Date().toISOString() }
            : { version, ok: false, error: d.error }
        )
      })
      .catch((e) => {
        if (e?.name !== "AbortError")
          setResultado({ version, ok: false, error: "No se pudo contactar con el servidor." })
      })
    return () => control.abort()
  }, [peticion])

  const consultar = (cambio: Partial<Consulta>) =>
    setPeticion((p) => ({ consulta: { ...p.consulta, ...cambio }, version: p.version + 1 }))

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault()
    consultar({ ...borrador, pagina: 1 })
  }

  const c = peticion.consulta
  const total = resultado?.ok ? resultado.total : 0
  const totalPaginas = Math.max(1, Math.ceil(total / c.tamano))
  const pendientes = etl.conjunto.aCargar.length

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <DatabaseIcon />
        <AlertTitle>Datos persistidos en Supabase</AlertTitle>
        <AlertDescription>
          Esta tabla es una lectura real de <code>mediciones_meteorologicas</code> hecha por el servidor.
          No incluye los datos locales de la sesión: ahora mismo tienes{" "}
          <strong>{formatearEntero(pendientes)}</strong> registros seleccionados en local, pendientes de
          subir o de volver a subir.
        </AlertDescription>
      </Alert>

      <form onSubmit={aplicar} className="grid grid-cols-1 gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-ciudad" className="text-xs">Ciudad</Label>
          <select id="sb-ciudad" className={claseSelect} value={borrador.ciudad} onChange={(e) => setBorrador({ ...borrador, ciudad: e.target.value })}>
            <option value="">Todas</option>
            {CIUDADES.map((ci) => (
              <option key={ci.id} value={ci.nombre}>{ci.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-desde" className="text-xs">Desde (UTC)</Label>
          <Input id="sb-desde" type="datetime-local" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-hasta" className="text-xs">Hasta (UTC, incluida)</Label>
          <Input id="sb-hasta" type="datetime-local" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sb-orden" className="text-xs">ORDER BY</Label>
          <div className="flex gap-1">
            <select id="sb-orden" className={claseSelect} value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: e.target.value })}>
              {ORDENES.map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </select>
            <select aria-label="Dirección" className={claseSelect} value={borrador.direccion} onChange={(e) => setBorrador({ ...borrador, direccion: e.target.value as "asc" | "desc" })}>
              <option value="asc">Asc.</option>
              <option value="desc">Desc.</option>
            </select>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Aplicar</Button>
          <Button type="button" variant="outline" disabled={cargando} onClick={() => consultar({})}>
            <RefreshCwIcon data-icon="inline-start" className={cargando ? "animate-spin" : undefined} />
            Actualizar
          </Button>
        </div>
      </form>

      {resultado && !resultado.ok && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>No se pudo leer Supabase</AlertTitle>
          <AlertDescription>{resultado.error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border" aria-busy={cargando}>
        <Table aria-label="Datos persistidos en Supabase">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right">id</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Fecha y hora (UTC)</TableHead>
              <TableHead className="text-right">Temperatura (°C)</TableHead>
              <TableHead className="text-right">Humedad (%)</TableHead>
              <TableHead className="text-right">Precipitación (mm)</TableHead>
              <TableHead>Importado en (UTC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultado?.ok && resultado.filas.length ? (
              resultado.filas.map((f) => (
                <TableRow key={f.id} className={cargando ? "opacity-50" : undefined}>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{f.id}</TableCell>
                  <TableCell>{f.ciudad}</TableCell>
                  <TableCell className="tabular-nums">{formatearFechaUtc(f.fecha_hora)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.temperatura_c)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.humedad_pct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.precipitacion_mm)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatearFechaUtc(f.importado_en)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {cargando ? "Consultando Supabase…" : resultado?.ok ? "La consulta no devuelve filas." : "Sin datos."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <nav aria-label="Paginación de Supabase" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {resultado?.ok
            ? `${formatearEntero(total)} filas persistidas con estos filtros · leído ${resultado.leidoEn.slice(11, 19)} UTC`
            : "—"}
        </span>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1">
            Filas por página
            <select className="h-7 rounded-md border bg-background px-1 text-xs text-foreground" value={c.tamano} onChange={(e) => consultar({ tamano: Number(e.target.value), pagina: 1 })}>
              {[25, 50, 100].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={cargando || c.pagina <= 1} onClick={() => consultar({ pagina: c.pagina - 1 })}>
            Anterior
          </Button>
          <span className="px-2 tabular-nums">Página {c.pagina} de {totalPaginas}</span>
          <Button size="sm" variant="outline" disabled={cargando || c.pagina >= totalPaginas} onClick={() => consultar({ pagina: c.pagina + 1 })}>
            Siguiente
          </Button>
        </div>
      </nav>
    </div>
  )
}
