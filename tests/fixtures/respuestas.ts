/**
 * Fixtures controlados con la forma de una respuesta de Open-Meteo.
 * Solo se usan en las pruebas: nunca se mezclan con extracciones reales.
 */

function horas(dia: string, n: number): string[] {
  return Array.from({ length: n }, (_, h) => `${dia}T${String(h).padStart(2, "0")}:00`)
}

function respuesta(hourly: Record<string, unknown>, utcOffset = 0) {
  return {
    latitude: 41.44,
    longitude: 2.2,
    utc_offset_seconds: utcOffset,
    timezone: "GMT",
    hourly_units: {
      time: "iso8601",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      precipitation: "mm",
    },
    hourly,
  }
}

/** Un día completo y limpio: 24 horas. */
export const diaCompleto = respuesta({
  time: horas("2026-09-01", 24),
  temperature_2m: Array.from({ length: 24 }, (_, i) => 20 + i / 10),
  relative_humidity_2m: Array.from({ length: 24 }, (_, i) => 50 + i),
  precipitation: Array.from({ length: 24 }, (_, i) => (i === 5 ? 1.2 : 0)),
})

/** Valores problemáticos en posiciones conocidas. */
export const conProblemas = respuesta({
  time: [
    "2026-09-01T00:00", // 0 válido
    "2026-09-01T01:00", // 1 temperatura null
    "2026-09-01T02:00", // 2 humedad cadena vacía
    "2026-09-01T03:00", // 3 precipitación texto
    "2026-09-01T04:00", // 4 humedad > 100
    "2026-09-01T05:00", // 5 precipitación negativa
    "2026-09-01T06:00", // 6 temperatura extrema: válida
    "2026-02-30T07:00", // 7 fecha imposible
    null, //               8 sin fecha
    "2026-09-01T09:00", // 9 temperatura NaN
  ],
  temperature_2m: [10, null, 12, 13, 14, 15, -60.5, 17, 18, Number.NaN],
  relative_humidity_2m: [50, 51, "", 53, 100.5, 55, 0, 57, 58, 59],
  precipitation: [0, 0, 0, "0.4", 0, -0.1, 0, 0, 0, 0],
})

/** Mismas horas repetidas: la limpieza debe conservar solo la primera válida. */
export const conDuplicados = respuesta({
  time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T01:00"],
  temperature_2m: [10, null, 11, 12, 13],
  relative_humidity_2m: [50, 50, 60, 60, 70],
  precipitation: [0, 0, 0, 0, 0],
})

/** Arrays de longitudes distintas. */
export const longitudesIncoherentes = respuesta({
  time: horas("2026-09-01", 3),
  temperature_2m: [1, 2, 3],
  relative_humidity_2m: [50, 50],
  precipitation: [0, 0, 0, 0],
})

/** Respuesta en otra zona horaria (+02:00): las horas deben pasarse a UTC. */
export const conOffset = respuesta(
  {
    time: ["2026-09-01T00:00", "2026-09-01T01:00"],
    temperature_2m: [20, 21],
    relative_humidity_2m: [50, 51],
    precipitation: [0, 0],
  },
  7200
)

const { utc_offset_seconds: _omitido, ...sinOffsetBase } = respuesta({
  time: ["2026-09-01T00:00"],
  temperature_2m: [20],
  relative_humidity_2m: [50],
  precipitation: [0],
})
/** Respuesta sin utc_offset_seconds. */
export const sinOffset = sinOffsetBase
