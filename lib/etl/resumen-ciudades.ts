import type { RegistroMedicion } from "./tipos"

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

export type Metrica = "temperatura" | "humedad" | "precipitacion"

export const METRICAS: Record<Metrica, { texto: string; unidad: string; valor: (r: ResumenCiudad) => number }> = {
  temperatura: { texto: "Temperatura media", unidad: "°C", valor: (r) => r.temperaturaMedia },
  humedad: { texto: "Humedad media", unidad: "%", valor: (r) => r.humedadMedia },
  precipitacion: { texto: "Precipitación total", unidad: "mm", valor: (r) => r.precipitacionTotal },
}

// Rampa secuencial de un solo tono (claro → oscuro) para la magnitud de la métrica en el mapa.
export const RAMPA_SECUENCIAL = ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const

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
