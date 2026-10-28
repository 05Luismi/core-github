import { CIUDADES, buscarCiudad } from "./ciudades"
import type { RegistroMedicion, RegistroRechazado } from "./tipos"

export type ResumenCiudad = {
  horas: number
  temperaturaMedia: number
  temperaturaMin: number
  temperaturaMax: number
  humedadMedia: number
  precipitacionTotal: number
  /** Horas con precipitación > 0. */
  horasConLluvia: number
}

/** Agrega los registros válidos por nombre de ciudad. Las ciudades sin registros no aparecen. */
export function resumirPorCiudad(registros: readonly RegistroMedicion[]): Map<string, ResumenCiudad> {
  const salida = new Map<string, ResumenCiudad>()
  const sumas = new Map<string, { t: number; h: number }>()
  for (const r of registros) {
    const a = salida.get(r.ciudad)
    const s = sumas.get(r.ciudad) ?? { t: 0, h: 0 }
    s.t += r.temperatura_c
    s.h += r.humedad_pct
    sumas.set(r.ciudad, s)
    if (!a) {
      salida.set(r.ciudad, {
        horas: 1,
        temperaturaMedia: 0,
        temperaturaMin: r.temperatura_c,
        temperaturaMax: r.temperatura_c,
        humedadMedia: 0,
        precipitacionTotal: r.precipitacion_mm,
        horasConLluvia: r.precipitacion_mm > 0 ? 1 : 0,
      })
      continue
    }
    a.horas++
    a.temperaturaMin = Math.min(a.temperaturaMin, r.temperatura_c)
    a.temperaturaMax = Math.max(a.temperaturaMax, r.temperatura_c)
    a.precipitacionTotal += r.precipitacion_mm
    if (r.precipitacion_mm > 0) a.horasConLluvia++
  }
  for (const [ciudad, a] of salida) {
    const s = sumas.get(ciudad)!
    a.temperaturaMedia = s.t / a.horas
    a.humedadMedia = s.h / a.horas
  }
  return salida
}

export type ResumenDia = {
  /** Día UTC, "AAAA-MM-DD". */
  dia: string
  temperaturaMedia: number
  temperaturaMin: number
  temperaturaMax: number
  humedadMedia: number
  /** Precipitación del día dividida entre las ciudades con datos ese día (mm por ciudad). */
  precipitacionMedia: number
  ciudades: number
}

/** Agrega los registros válidos por día UTC (todas las ciudades juntas), en orden cronológico. */
export function resumirPorDia(registros: readonly RegistroMedicion[]): ResumenDia[] {
  const dias = new Map<string, { n: number; t: number; h: number; p: number; min: number; max: number; ciudades: Set<string> }>()
  for (const r of registros) {
    const dia = r.fecha_hora.slice(0, 10)
    const a = dias.get(dia) ?? { n: 0, t: 0, h: 0, p: 0, min: Infinity, max: -Infinity, ciudades: new Set<string>() }
    a.n++
    a.t += r.temperatura_c
    a.h += r.humedad_pct
    a.p += r.precipitacion_mm
    a.min = Math.min(a.min, r.temperatura_c)
    a.max = Math.max(a.max, r.temperatura_c)
    a.ciudades.add(r.ciudad)
    dias.set(dia, a)
  }
  return [...dias]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, a]) => ({
      dia,
      temperaturaMedia: a.t / a.n,
      temperaturaMin: a.min,
      temperaturaMax: a.max,
      humedadMedia: a.h / a.n,
      precipitacionMedia: a.p / a.ciudades.size,
      ciudades: a.ciudades.size,
    }))
}

export type ConteoCiudad = { ciudad: string; validos: number; rechazados: number }

/** Válidos y rechazados por ciudad, en el orden de la lista de ciudades (las desconocidas al final). */
export function contarPorCiudad(
  validos: readonly RegistroMedicion[],
  rechazados: readonly RegistroRechazado[]
): ConteoCiudad[] {
  const conteos = new Map<string, ConteoCiudad>()
  const de = (ciudad: string) => {
    const c = conteos.get(ciudad) ?? { ciudad, validos: 0, rechazados: 0 }
    conteos.set(ciudad, c)
    return c
  }
  for (const r of validos) de(r.ciudad).validos++
  for (const { registro } of rechazados)
    de(registro.ciudad ?? buscarCiudad(registro.ciudadId)?.nombre ?? registro.ciudadId).rechazados++
  const orden = CIUDADES.map((c) => c.nombre)
  const posicion = (n: string) => (orden.includes(n) ? orden.indexOf(n) : orden.length)
  return [...conteos.values()].sort((a, b) => posicion(a.ciudad) - posicion(b.ciudad))
}

export type Metrica = "temperatura" | "humedad" | "precipitacion"

export const METRICAS: Record<Metrica, { texto: string; unidad: string; valor: (r: ResumenCiudad) => number }> = {
  temperatura: { texto: "Temperatura media", unidad: "°C", valor: (r) => r.temperaturaMedia },
  humedad: { texto: "Humedad media", unidad: "%", valor: (r) => r.humedadMedia },
  precipitacion: { texto: "Precipitación total", unidad: "mm", valor: (r) => r.precipitacionTotal },
}

// Rampa secuencial de un solo tono (claro → oscuro) para la magnitud de la métrica en el mapa.
export const RAMPA_SECUENCIAL = ["#fde3cf", "#fbc49b", "#f8a266", "#f07f36", "#d4611a", "#a3460f"] as const

/** Paso de la rampa para t ∈ [0, 1] (se recorta fuera de rango). */
export function colorRampa(t: number): string {
  const i = Math.round(Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (RAMPA_SECUENCIAL.length - 1))
  return RAMPA_SECUENCIAL[i]
}

/** Registros de una ciudad ordenados por fecha (la clave natural garantiza una fila por hora). */
export function serieCiudad(registros: readonly RegistroMedicion[], ciudad: string): RegistroMedicion[] {
  return registros.filter((r) => r.ciudad === ciudad).sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
}

const COLUMNAS_CSV = ["ciudad", "fecha_hora", "temperatura_c", "humedad_pct", "precipitacion_mm"] as const

function celdaCsv(v: string | number): string {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con cabecera, separador coma y punto decimal (formato neutro para hojas de cálculo y pandas). */
export function aCsv(registros: readonly RegistroMedicion[]): string {
  const filas = registros.map((r) => COLUMNAS_CSV.map((c) => celdaCsv(r[c])).join(","))
  return [COLUMNAS_CSV.join(","), ...filas].join("\n") + "\n"
}
