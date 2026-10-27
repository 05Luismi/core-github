import { NOMBRES_CIUDADES } from "./ciudades"
import type { RegistroMedicion } from "./tipos"

/** Describe un valor problemático sin convertirlo (null nunca se trata como 0). */
export function describirValor(v: unknown): string {
  if (v === undefined) return "ausente"
  if (v === null) return "null"
  if (v === "") return "cadena vacía"
  if (typeof v === "string") return `texto «${v}»`
  if (typeof v === "number") return String(v)
  return typeof v
}

const CAMPOS = [
  { campo: "temperatura_c", etiqueta: "temperatura" },
  { campo: "humedad_pct", etiqueta: "humedad" },
  { campo: "precipitacion_mm", etiqueta: "precipitación" },
] as const

/** Reglas de calidad de las tres mediciones. Devuelve los motivos de rechazo. */
export function validarMediciones(r: {
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}): string[] {
  const motivos: string[] = []
  for (const { campo, etiqueta } of CAMPOS) {
    const v = r[campo]
    if (typeof v !== "number" || !Number.isFinite(v)) {
      motivos.push(`Falta ${etiqueta} válida (${describirValor(v)})`)
    }
  }
  // Sin umbrales para la temperatura: un valor extremo no es un error de calidad.
  const h = r.humedad_pct
  if (typeof h === "number" && Number.isFinite(h) && (h < 0 || h > 100))
    motivos.push(`Humedad fuera de 0–100 % (${h})`)
  const p = r.precipitacion_mm
  if (typeof p === "number" && Number.isFinite(p) && p < 0)
    motivos.push(`Precipitación negativa (${p} mm)`)
  return motivos
}

const PATRON_UTC_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/

export function esFechaHoraUtcValida(v: unknown): v is string {
  if (typeof v !== "string" || !PATRON_UTC_HORA.test(v)) return false
  const ms = Date.parse(v)
  return (
    !Number.isNaN(ms) &&
    new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") === v
  )
}

/**
 * Validación del registro normalizado. La usa el servidor antes de escribir
 * en Supabase: no confía en que el navegador haya limpiado los datos.
 */
export function validarRegistroMedicion(v: unknown): {
  ok: boolean
  motivos: string[]
  registro?: RegistroMedicion
} {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    return { ok: false, motivos: ["No es un objeto"] }
  const o = v as Record<string, unknown>
  const motivos: string[] = []
  const permitidos = new Set([
    "ciudad",
    "fecha_hora",
    "temperatura_c",
    "humedad_pct",
    "precipitacion_mm",
  ])
  const extra = Object.keys(o).filter((k) => !permitidos.has(k))
  if (extra.length) motivos.push(`Campos no permitidos: ${extra.join(", ")}`)
  if (typeof o.ciudad !== "string" || !NOMBRES_CIUDADES.has(o.ciudad))
    motivos.push(`Ciudad no reconocida (${describirValor(o.ciudad)})`)
  if (!esFechaHoraUtcValida(o.fecha_hora))
    motivos.push(
      `fecha_hora debe ser una hora exacta en UTC, AAAA-MM-DDTHH:00:00Z (${describirValor(o.fecha_hora)})`
    )
  motivos.push(...validarMediciones(o as Parameters<typeof validarMediciones>[0]))
  if (motivos.length) return { ok: false, motivos }
  return {
    ok: true,
    motivos,
    registro: {
      ciudad: o.ciudad as string,
      fecha_hora: o.fecha_hora as string,
      temperatura_c: o.temperatura_c as number,
      humedad_pct: o.humedad_pct as number,
      precipitacion_mm: o.precipitacion_mm as number,
    },
  }
}
