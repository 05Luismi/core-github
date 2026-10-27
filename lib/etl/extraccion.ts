import type { Ciudad } from "./ciudades"

export const URL_ARCHIVO_OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS_EXTRACCION = 31
export const FECHA_MINIMA_ARCHIVO = "1940-01-01"
/** Open-Meteo publica ERA5 con unos 5 días de retraso: las horas más recientes pueden llegar como null. */
export const DIAS_RETRASO_ARCHIVO = 5

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/
const MS_DIA = 86_400_000

/** Convierte "AAAA-MM-DD" en milisegundos UTC, o null si no es una fecha real del calendario. */
export function fechaIsoAMs(fecha: string): number | null {
  if (!PATRON_FECHA.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  // Rechaza fechas desbordadas como 2026-02-30, que Date normalizaría a marzo.
  if (new Date(ms).toISOString().slice(0, 10) !== fecha) return null
  return ms
}

export function hoyUtcIso(ahora = new Date()): string {
  return ahora.toISOString().slice(0, 10)
}

/** Número de días del intervalo, ambos extremos incluidos. */
export function diasIncluidos(inicio: string, fin: string): number | null {
  const a = fechaIsoAMs(inicio)
  const b = fechaIsoAMs(fin)
  if (a === null || b === null || b < a) return null
  return (b - a) / MS_DIA + 1
}

export type ResultadoValidacionPeriodo = {
  errores: string[]
  avisos: string[]
  dias: number | null
}

export function validarPeriodo(
  inicio: string,
  fin: string,
  ahora = new Date()
): ResultadoValidacionPeriodo {
  const errores: string[] = []
  const avisos: string[] = []
  const a = fechaIsoAMs(inicio)
  const b = fechaIsoAMs(fin)
  const hoy = hoyUtcIso(ahora)

  if (a === null) errores.push("La fecha inicial no es válida (formato AAAA-MM-DD).")
  if (b === null) errores.push("La fecha final no es válida (formato AAAA-MM-DD).")
  if (a !== null && b !== null) {
    if (b < a) errores.push("La fecha final debe ser igual o posterior a la inicial.")
    else if ((b - a) / MS_DIA + 1 > MAX_DIAS_EXTRACCION)
      errores.push(
        `El periodo supera el máximo de ${MAX_DIAS_EXTRACCION} días por extracción.`
      )
  }
  if (a !== null && inicio < FECHA_MINIMA_ARCHIVO)
    errores.push(`El archivo histórico empieza el ${FECHA_MINIMA_ARCHIVO}.`)
  if (b !== null && fin > hoy)
    errores.push("La fecha final no puede ser posterior a hoy (UTC).")

  const limiteRetraso = new Date(
    Date.parse(`${hoy}T00:00:00Z`) - DIAS_RETRASO_ARCHIVO * MS_DIA
  )
    .toISOString()
    .slice(0, 10)
  if (b !== null && fin <= hoy && fin > limiteRetraso)
    avisos.push(
      `Los últimos ${DIAS_RETRASO_ARCHIVO} días pueden no estar publicados aún: esas horas llegarán como null y se rechazarán en la limpieza.`
    )

  return { errores, avisos, dias: errores.length ? null : diasIncluidos(inicio, fin) }
}

export function construirUrlOpenMeteo(
  ciudad: Ciudad,
  inicio: string,
  fin: string
): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "GMT",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params.toString()}`
}
