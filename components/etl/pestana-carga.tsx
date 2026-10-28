"use client"

import * as React from "react"
import { CircleAlertIcon, DatabaseIcon, InfoIcon, RotateCwIcon, UploadCloudIcon } from "lucide-react"

import { EstadoFaseBadge } from "@/components/etl/estado-fase"
import { COLUMNAS_MEDICION } from "@/components/etl/pestana-validos"
import { alternarOrden, TablaPaginada, type Columna } from "@/components/etl/tabla-paginada"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EstadoFase, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { TAMANO_LOTE, type EstadoLote } from "@/lib/etl/carga"
import type { CampoOrden } from "@/lib/etl/filtros"
import { formatearDuracion, formatearEntero, formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import type { RegistroMedicion, RegistroValido } from "@/lib/etl/tipos"

const COLUMNAS_VISTA: Columna<RegistroValido>[] = [
  { id: "n", encabezado: "Posición de envío", celda: (_, i) => i, numerica: true, className: "w-28 text-muted-foreground" },
  ...COLUMNAS_MEDICION,
]

const COLUMNAS_CONGELADOS: Columna<RegistroMedicion>[] = [
  { id: "n", encabezado: "Posición", celda: (_, i) => i, numerica: true, className: "text-muted-foreground" },
  { id: "ciudad", encabezado: "Ciudad", celda: (r) => r.ciudad },
  { id: "fecha", encabezado: "Fecha y hora (UTC)", celda: (r) => formatearFechaUtc(r.fecha_hora) },
  { id: "t", encabezado: "Temperatura (°C)", celda: (r) => formatearNumero(r.temperatura_c), numerica: true },
  { id: "h", encabezado: "Humedad (%)", celda: (r) => formatearNumero(r.humedad_pct), numerica: true },
  { id: "p", encabezado: "Precipitación (mm)", celda: (r) => formatearNumero(r.precipitacion_mm), numerica: true },
]

const ESTADO_LOTE: Record<EstadoLote["estado"], { estado: EstadoFase; texto: string }> = {
  pendiente: { estado: "pendiente", texto: "Pendiente" },
  enviando: { estado: "en_curso", texto: "Enviando" },
  completado: { estado: "completada", texto: "Completado" },
  error: { estado: "error", texto: "Error" },
}

export function PestanaCarga({ etl }: { etl: PipelineEtl }) {
  const { aCargar } = etl.conjunto
  const s = etl.estadoSupabase
  const carga = etl.carga
  const lotesPrevistos = Math.ceil(aCargar.length / TAMANO_LOTE)
  const [confirmando, setConfirmando] = React.useState(false)
  const ciudadesACargar = new Set(aCargar.map((r) => r.ciudad)).size

  const bloqueoSupabase = !s
    ? "Comprobando la conexión con Supabase…"
    : !s.configurado || !s.tablaDisponible
      ? s.mensaje
      : !s.escrituraPermitida
        ? "La escritura está deshabilitada en producción (ETL_PERMITIR_ESCRITURA)."
        : null
  const deshabilitado = !aCargar.length || etl.cargando || etl.extrayendo || bloqueoSupabase !== null

  const completados = carga?.lotes.filter((l) => l.estado === "completado") ?? []
  const fallidos = carga?.lotes.filter((l) => l.estado === "error") ?? []
  const registrosOk = completados.reduce((n, l) => n + l.registros.length, 0)
  const registrosFallidos = fallidos.reduce((n, l) => n + l.registros.length, 0)
  const afectados = completados.reduce((n, l) => n + (l.procesados ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-center">
        <div className="mr-auto flex flex-col gap-0.5">
          <p className="font-medium">
            Se enviarán <span className="tabular-nums">{formatearEntero(aCargar.length)}</span> registros en{" "}
            {lotesPrevistos} {lotesPrevistos === 1 ? "lote" : "lotes"} de hasta {TAMANO_LOTE}, en este orden.
          </p>
          <p className="text-xs text-muted-foreground">
            Huella del conjunto: <code>{etl.huellaVistaPrevia}</code> (cambia si cambia cualquier fila o el orden)
          </p>
        </div>
        <Button size="lg" disabled={deshabilitado} onClick={() => setConfirmando(true)}>
          <UploadCloudIcon data-icon="inline-start" />
          {etl.cargando ? "Subiendo…" : `Subir ${formatearEntero(aCargar.length)} registros a Supabase`}
        </Button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
              <UploadCloudIcon aria-hidden className="size-4.5" />
            </span>
            <div className="flex flex-col gap-1">
              <AlertDialogTitle>¿Subir {formatearEntero(aCargar.length)} registros a Supabase?</AlertDialogTitle>
              <AlertDialogDescription>
                Se escribirán en la tabla <code>mediciones_meteorologicas</code>. Si ya existe una fila con
                la misma ciudad y hora, se <strong>sobrescribe</strong> con los valores nuevos.
              </AlertDialogDescription>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center">
            {[
              ["Registros", formatearEntero(aCargar.length)],
              ["Ciudades", formatearEntero(ciudadesACargar)],
              ["Lotes", `${lotesPrevistos} × ≤${TAMANO_LOTE}`],
            ].map(([t, v]) => (
              <div key={t}>
                <dt className="text-xs text-muted-foreground">{t}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-end gap-2">
            <AlertDialogClose render={<Button variant="outline" />}>Cancelar</AlertDialogClose>
            <Button
              disabled={deshabilitado}
              onClick={() => {
                setConfirmando(false)
                etl.cargar()
              }}
            >
              <UploadCloudIcon data-icon="inline-start" />
              Sí, subir
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {bloqueoSupabase && aCargar.length > 0 && (
        <Alert variant={s ? "destructive" : "default"}>
          <CircleAlertIcon />
          <AlertTitle>No se puede cargar todavía</AlertTitle>
          <AlertDescription>{bloqueoSupabase}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <InfoIcon />
        <AlertDescription>
          El orden de envío es el que eliges aquí, pero una tabla de base de datos <strong>no conserva el
          orden de inserción</strong>: cualquier consulta posterior debe indicar <code>ORDER BY</code> (por
          ejemplo, <code>order by ciudad, fecha_hora</code>) para obtener un orden concreto.
        </AlertDescription>
      </Alert>

      {carga && (
        <section aria-labelledby="titulo-informe" className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="titulo-informe" className="mr-auto font-medium">
              Informe de la carga
            </h3>
            <EstadoFaseBadge estado={carga.estado} />
            {fallidos.length > 0 && (
              <Button size="sm" variant="outline" disabled={etl.cargando} onClick={etl.reintentarLotesFallidos}>
                <RotateCwIcon data-icon="inline-start" />
                Reintentar {fallidos.length} {fallidos.length === 1 ? "lote fallido" : "lotes fallidos"}
              </Button>
            )}
          </div>
          {etl.cargando && (
            <Progress
              value={Math.round(((completados.length + fallidos.length) / Math.max(1, carga.lotes.length)) * 100)}
              etiqueta={carga.verificando ? "Verificando en Supabase…" : `Lotes procesados: ${completados.length + fallidos.length} de ${carga.lotes.length}`}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Copia congelada al pulsar el botón: {formatearEntero(carga.congelados.length)} registros, huella{" "}
            <code>{carga.huella}</code>.{" "}
            {carga.huella === etl.huellaVistaPrevia
              ? "Coincide con la vista previa actual."
              : "La vista previa actual ha cambiado desde entonces; la carga sigue usando su copia."}
          </p>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Registros enviados correctamente", registrosOk],
              ["Filas afectadas según Supabase", afectados],
              ["Registros en lotes fallidos", registrosFallidos],
              ["Pendientes", carga.congelados.length - registrosOk - registrosFallidos],
            ].map(([t, v]) => (
              <div key={t} className="rounded-lg bg-muted/50 p-2">
                <dt className="text-xs text-muted-foreground">{t}</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatearEntero(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            El upsert no indica cuántas filas eran nuevas y cuántas se actualizaron, así que no se
            muestran por separado. Duración total: {formatearDuracion(carga.duracionMs)}.
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <Table aria-label="Estado por lote">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Posiciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Filas afectadas</TableHead>
                  <TableHead className="text-right">Intentos</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carga.lotes.map((l) => (
                  <TableRow key={l.numero}>
                    <TableCell className="tabular-nums">{l.numero}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatearEntero(l.desde)}–{formatearEntero(l.hasta)}
                    </TableCell>
                    <TableCell>
                      <EstadoFaseBadge {...ESTADO_LOTE[l.estado]} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.procesados === null ? "—" : formatearEntero(l.procesados)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.intentos}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearDuracion(l.duracionMs)}</TableCell>
                    <TableCell className="max-w-96 text-xs whitespace-normal text-destructive">{l.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div aria-live="polite" className="flex items-start gap-2 text-sm">
            <DatabaseIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {carga.verificando ? (
              <span>Verificando en Supabase que las claves enviadas existen…</span>
            ) : carga.verificacion ? (
              <span>
                Verificación en destino: {formatearEntero(carga.verificacion.encontrados)} de{" "}
                {formatearEntero(carga.verificacion.comprobados)} claves enviadas existen en Supabase
                {carga.verificacion.faltantes.length > 0 && (
                  <strong className="text-destructive">
                    {" "}· faltan {formatearEntero(carga.verificacion.faltantes.length)} (p. ej.{" "}
                    {carga.verificacion.faltantes.slice(0, 3).join(", ")})
                  </strong>
                )}
                {carga.verificacion.errores.map((e) => (
                  <span key={e} className="block text-destructive">Error al verificar: {e}</span>
                ))}
              </span>
            ) : carga.estado === "en_curso" ? (
              <span>La verificación se hará al terminar los lotes.</span>
            ) : (
              <span>No hay lotes completados que verificar.</span>
            )}
          </div>

          <details>
            <summary className="cursor-pointer text-sm">Ver la copia congelada enviada</summary>
            <div className="mt-2">
              <TablaPaginada
                etiqueta="Copia congelada de la carga"
                filas={carga.congelados}
                columnas={COLUMNAS_CONGELADOS}
                claveFila={(r) => `${r.ciudad}|${r.fecha_hora}`}
              />
            </div>
          </details>
        </section>
      )}

      <section aria-labelledby="titulo-vista-previa" className="flex flex-col gap-2">
        <h3 id="titulo-vista-previa" className="font-medium">
          Vista previa: conjunto exacto que se enviará
        </h3>
        <p className="text-xs text-muted-foreground">
          Filas seleccionadas que cumplen los filtros actuales, en el orden elegido. Datos locales:
          todavía no están en Supabase.
        </p>
        <TablaPaginada
          etiqueta="Vista previa de la carga"
          filas={aCargar}
          columnas={COLUMNAS_VISTA}
          claveFila={(r) => r.clave}
          orden={etl.orden}
          onOrdenar={(campo) => etl.setOrden(alternarOrden(etl.orden, campo as CampoOrden))}
          vacio="No hay filas seleccionadas que cumplan los filtros. Selecciónalas en Datos → Válidos."
        />
      </section>
    </div>
  )
}
