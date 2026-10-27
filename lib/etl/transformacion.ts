import type { RegistroTransformado } from "./tipos"

const PATRON_HORA_OPEN_METEO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Variables de Open-Meteo y su nombre en la estructura normalizada. */
export const MAPA_VARIABLES = {
  temperature_2m: "temperatura_c",
  relative_humidity_2m: "humedad_pct",
  precipitation: "precipitacion_mm",
} as const

export type ResultadoTransformacionCiudad = {
  registros: RegistroTransformado[]
  /** Avisos a nivel de ciudad (estructura inesperada, longitudes distintas...). */
  incidencias: string[]
  longitudes: Record<string, number | null>
}

/** Normaliza un instante a "AAAA-MM-DDTHH:MM:SSZ". */
export function formatearUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
}

/**
 * Interpreta una hora local de Open-Meteo ("2026-09-01T00:00") aplicando el
 * offset de la respuesta. Con timezone=GMT el offset es 0, pero no se asume:
 * se resta explícitamente para obtener UTC.
 */
export function interpretarHora(
  valor: unknown,
  offsetSegundos: number
): string | null {
  if (typeof valor !== "string") return null
  const m = PATRON_HORA_OPEN_METEO.exec(valor)
  if (!m) return null
  const [, dia, hh, mm, ss = "00"] = m
  const textoLocal = `${dia}T${hh}:${mm}:${ss}`
  const msLocal = Date.parse(`${textoLocal}Z`)
  if (Number.isNaN(msLocal)) return null
  // Evita que Date normalice fechas imposibles (2026-02-30T25:00).
  if (new Date(msLocal).toISOString().slice(0, 19) !== textoLocal) return null
  return formatearUtc(msLocal - offsetSegundos * 1000)
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Convierte los arrays paralelos de `hourly` en un registro por hora.
 * No valida ni corrige valores: eso corresponde a la limpieza.
 */
export function transformarRespuesta(
  ciudadId: string,
  nombreCiudad: string | null,
  respuesta: unknown
): ResultadoTransformacionCiudad {
  const incidencias: string[] = []
  const longitudes: Record<string, number | null> = {}

  if (!esObjeto(respuesta) || !esObjeto(respuesta.hourly)) {
    return {
      registros: [],
      incidencias: ["La respuesta no contiene el objeto «hourly»."],
      longitudes,
    }
  }
  const hourly = respuesta.hourly

  const offset = respuesta.utc_offset_seconds
  const offsetValido = typeof offset === "number" && Number.isInteger(offset)
  if (!offsetValido)
    incidencias.push(
      "Falta «utc_offset_seconds»: no se puede garantizar que las horas sean UTC y se marcarán como inválidas."
    )

  const arrays: Record<string, unknown[] | null> = {}
  for (const nombre of ["time", ...Object.keys(MAPA_VARIABLES)]) {
    const v = hourly[nombre]
    arrays[nombre] = Array.isArray(v) ? v : null
    longitudes[nombre] = Array.isArray(v) ? v.length : null
    if (!Array.isArray(v)) incidencias.push(`Falta el array «${nombre}».`)
  }

  const longitudTime = longitudes.time ?? 0
  for (const nombre of Object.keys(MAPA_VARIABLES)) {
    const l = longitudes[nombre]
    if (l !== null && l !== longitudTime)
      incidencias.push(
        `Longitud incoherente: «${nombre}» tiene ${l} valores y «time» ${longitudTime}.`
      )
  }

  // Se recorre la longitud máxima para no perder en silencio valores sobrantes:
  // las posiciones incompletas generan registros que la limpieza rechazará.
  const total = Math.max(
    0,
    ...Object.values(longitudes).map((l) => l ?? 0)
  )
  const registros: RegistroTransformado[] = []
  for (let i = 0; i < total; i++) {
    const problemas: string[] = []
    const leer = (nombre: string): unknown => {
      const arr = arrays[nombre]
      if (arr === null) return undefined
      if (i >= arr.length) {
        problemas.push(`«${nombre}» no tiene posición ${i}`)
        return undefined
      }
      return arr[i]
    }
    const fechaOriginal = leer("time")
    registros.push({
      uid: `${ciudadId}#${i}`,
      ciudadId,
      ciudad: nombreCiudad,
      indice: i,
      fecha_original: fechaOriginal,
      fecha_hora: offsetValido
        ? interpretarHora(fechaOriginal, offset as number)
        : null,
      temperatura_c: leer("temperature_2m"),
      humedad_pct: leer("relative_humidity_2m"),
      precipitacion_mm: leer("precipitation"),
      incidencias: problemas,
    })
  }

  return { registros, incidencias, longitudes }
}
