"use client"

import { CircleAlertIcon, ListChecksIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { alternarOrden, TablaPaginada, type Columna } from "@/components/etl/tabla-paginada"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import type { CampoOrden, FormularioFiltros } from "@/lib/etl/filtros"
import { formatearEntero, formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import type { RegistroValido } from "@/lib/etl/tipos"

export const CAMPOS_ORDEN: { valor: CampoOrden; texto: string }[] = [
  { valor: "ciudad", texto: "Ciudad" },
  { valor: "fecha_hora", texto: "Fecha y hora" },
  { valor: "temperatura_c", texto: "Temperatura" },
  { valor: "humedad_pct", texto: "Humedad" },
  { valor: "precipitacion_mm", texto: "Precipitación" },
]

export const claseSelect =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export const COLUMNAS_MEDICION: Columna<RegistroValido>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.ciudad, campoOrden: "ciudad" },
  { id: "fecha", encabezado: "Fecha y hora (UTC)", celda: (r) => formatearFechaUtc(r.fecha_hora), className: "tabular-nums", campoOrden: "fecha_hora" },
  { id: "t", encabezado: "Temperatura (°C)", celda: (r) => formatearNumero(r.temperatura_c), numerica: true, campoOrden: "temperatura_c" },
  { id: "h", encabezado: "Humedad (%)", celda: (r) => formatearNumero(r.humedad_pct), numerica: true, campoOrden: "humedad_pct" },
  { id: "p", encabezado: "Precipitación (mm)", celda: (r) => formatearNumero(r.precipitacion_mm), numerica: true, campoOrden: "precipitacion_mm" },
]

function Rango({
  titulo,
  unidad,
  min,
  max,
  onMin,
  onMax,
  id,
}: {
  titulo: string
  unidad: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  id: string
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-medium">
        {titulo} ({unidad})
      </legend>
      <div className="flex gap-1">
        <Input aria-label={`${titulo} mínima (${unidad})`} id={`${id}-min`} inputMode="decimal" placeholder="mín." value={min} onChange={(e) => onMin(e.target.value)} />
        <Input aria-label={`${titulo} máxima (${unidad})`} id={`${id}-max`} inputMode="decimal" placeholder="máx." value={max} onChange={(e) => onMax(e.target.value)} />
      </div>
    </fieldset>
  )
}

export function PestanaValidos({ etl }: { etl: PipelineEtl }) {
  const f = etl.formulario
  const set = <K extends keyof FormularioFiltros>(k: K, v: FormularioFiltros[K]) =>
    etl.setFormulario((prev) => ({ ...prev, [k]: v }))

  if (!etl.procesado) return <p className="py-6 text-muted-foreground">Sin registros válidos todavía.</p>

  const { coincidentes } = etl.conjunto
  const seleccionadosVisibles = etl.conjunto.aCargar.length
  const todosCoincidentesSeleccionados =
    coincidentes.length > 0 && seleccionadosVisibles === coincidentes.length

  const columnas: Columna<RegistroValido>[] = [
    {
      id: "sel",
      className: "w-10",
      encabezado: (filasPagina) => {
        const marcadas = filasPagina.filter((r) => etl.seleccion.has(r.clave)).length
        return (
          <Checkbox
            aria-label="Seleccionar las filas de esta página"
            checked={filasPagina.length > 0 && marcadas === filasPagina.length}
            indeterminate={marcadas > 0 && marcadas < filasPagina.length}
            disabled={!filasPagina.length}
            onCheckedChange={(v) => etl.seleccionarClaves(filasPagina.map((r) => r.clave), v)}
          />
        )
      },
      celda: (r) => (
        <Checkbox
          aria-label={`Seleccionar ${r.ciudad} ${formatearFechaUtc(r.fecha_hora)}`}
          checked={etl.seleccion.has(r.clave)}
          onCheckedChange={(v) => etl.alternarSeleccion(r.clave, v)}
        />
      ),
    },
    ...COLUMNAS_MEDICION,
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Orden de operaciones: <strong>válidos → filtros → ordenación → selección → carga</strong>. Pulsa
        una cabecera para ordenar. La paginación solo cambia lo que ves. Al cambiar los filtros no se
        selecciona nada automáticamente.
      </p>

      <form
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset className="flex flex-col gap-1 sm:col-span-2 xl:col-span-4">
          <legend className="mb-1 text-xs font-medium">Ciudades</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CIUDADES.map((c) => (
              <Label key={c.id} className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={f.ciudades.includes(c.nombre)}
                  onCheckedChange={(v) =>
                    set("ciudades", v ? [...f.ciudades, c.nombre] : f.ciudades.filter((n) => n !== c.nombre))
                  }
                />
                {c.nombre}
              </Label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filtro-desde" className="text-xs">Desde (UTC)</Label>
          <Input id="filtro-desde" type="datetime-local" value={f.desde} onChange={(e) => set("desde", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filtro-hasta" className="text-xs">Hasta (UTC, incluida)</Label>
          <Input id="filtro-hasta" type="datetime-local" value={f.hasta} onChange={(e) => set("hasta", e.target.value)} />
        </div>
        <Rango id="t" titulo="Temperatura" unidad="°C" min={f.temperaturaMin} max={f.temperaturaMax} onMin={(v) => set("temperaturaMin", v)} onMax={(v) => set("temperaturaMax", v)} />
        <Rango id="h" titulo="Humedad" unidad="%" min={f.humedadMin} max={f.humedadMax} onMin={(v) => set("humedadMin", v)} onMax={(v) => set("humedadMax", v)} />
        <Rango id="p" titulo="Precipitación" unidad="mm" min={f.precipitacionMin} max={f.precipitacionMax} onMin={(v) => set("precipitacionMin", v)} onMax={(v) => set("precipitacionMax", v)} />
        <Label className="flex items-center gap-2 self-end pb-2 font-normal">
          <Checkbox checked={f.soloLluvia} onCheckedChange={(v) => set("soloLluvia", v)} />
          Solo registros con lluvia (precipitación &gt; 0 mm)
        </Label>
        <div className="flex flex-col gap-1">
          <Label htmlFor="orden-campo" className="text-xs">Ordenar por</Label>
          <div className="flex gap-1">
            <select
              id="orden-campo"
              className={claseSelect}
              value={etl.orden.campo}
              onChange={(e) => etl.setOrden({ ...etl.orden, campo: e.target.value as CampoOrden })}
            >
              {CAMPOS_ORDEN.map((c) => (
                <option key={c.valor} value={c.valor}>{c.texto}</option>
              ))}
            </select>
            <select
              aria-label="Dirección del orden"
              className={claseSelect}
              value={etl.orden.direccion}
              onChange={(e) => etl.setOrden({ ...etl.orden, direccion: e.target.value as "asc" | "desc" })}
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={etl.restablecerFiltros}>
            <RotateCcwIcon data-icon="inline-start" />
            Restablecer filtros
          </Button>
        </div>
      </form>

      {etl.erroresFiltros.length > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {etl.erroresFiltros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            Los campos no numéricos se ignoran hasta que se corrijan.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm" aria-live="polite">
          <strong className="tabular-nums">{formatearEntero(coincidentes.length)}</strong> coinciden con
          los filtros ·{" "}
          <strong className="tabular-nums">{formatearEntero(seleccionadosVisibles)}</strong> seleccionados
          dentro de los filtros
          {etl.conjunto.seleccionadosFuera > 0 && (
            <> · {formatearEntero(etl.conjunto.seleccionadosFuera)} seleccionados fuera de los filtros</>
          )}
        </p>
        <Button size="sm" disabled={!coincidentes.length || todosCoincidentesSeleccionados} onClick={etl.seleccionarCoincidentes}>
          <ListChecksIcon data-icon="inline-start" />
          Seleccionar las {formatearEntero(coincidentes.length)} filas filtradas
        </Button>
        <Button size="sm" variant="outline" disabled={!etl.seleccion.size} onClick={etl.vaciarSeleccion}>
          <XIcon data-icon="inline-start" />
          Vaciar selección ({formatearEntero(etl.seleccion.size)})
        </Button>
      </div>

      <TablaPaginada
        etiqueta="Registros válidos filtrados"
        filas={coincidentes}
        columnas={columnas}
        claveFila={(r) => r.clave}
        reinicio={JSON.stringify([f, etl.orden])}
        claseFila={(r) => (etl.seleccion.has(r.clave) ? "bg-primary/8" : undefined)}
        orden={etl.orden}
        onOrdenar={(campo) => etl.setOrden(alternarOrden(etl.orden, campo as CampoOrden))}
        vacio="Ningún registro válido cumple los filtros actuales."
      />
    </div>
  )
}
