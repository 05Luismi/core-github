import { describe, expect, it } from "vitest"

import { validarPeriodo } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarRespuesta } from "@/lib/etl/transformacion"

import {
  conDuplicados,
  conOffset,
  conProblemas,
  diaCompleto,
  longitudesIncoherentes,
  sinOffset,
} from "./fixtures/respuestas"

describe("transformación de arrays paralelos", () => {
  it("convierte un día en 24 registros horarios en UTC, en orden", () => {
    const { registros, incidencias } = transformarRespuesta("barcelona", "Barcelona", diaCompleto)
    expect(incidencias).toEqual([])
    expect(registros).toHaveLength(24)
    expect(registros[0]).toMatchObject({
      ciudad: "Barcelona",
      fecha_hora: "2026-09-01T00:00:00Z",
      temperatura_c: 20,
      humedad_pct: 50,
      precipitacion_mm: 0,
    })
    expect(registros[23].fecha_hora).toBe("2026-09-01T23:00:00Z")
    // La posición i de cada array va al mismo registro.
    expect(registros[5]).toMatchObject({ temperatura_c: 20.5, humedad_pct: 55, precipitacion_mm: 1.2 })
  })

  it("aplica utc_offset_seconds explícitamente", () => {
    const { registros } = transformarRespuesta("madrid", "Madrid", conOffset)
    expect(registros.map((r) => r.fecha_hora)).toEqual([
      "2026-08-31T22:00:00Z",
      "2026-08-31T23:00:00Z",
    ])
  })

  it("no asume UTC si falta el offset", () => {
    const { registros, incidencias } = transformarRespuesta("madrid", "Madrid", sinOffset)
    expect(incidencias[0]).toMatch(/utc_offset_seconds/)
    expect(registros[0].fecha_hora).toBeNull()
  })

  it("detecta longitudes incoherentes sin perder posiciones", () => {
    const { registros, incidencias } = transformarRespuesta("bilbao", "Bilbao", longitudesIncoherentes)
    expect(incidencias).toHaveLength(2)
    expect(registros).toHaveLength(4)
    expect(registros[2].humedad_pct).toBeUndefined()
    const { validos, rechazados } = limpiar(registros)
    expect(validos).toHaveLength(2)
    expect(rechazados.map((r) => r.registro.indice)).toEqual([2, 3])
  })

  it("no convierte null, cadenas vacías ni texto en números", () => {
    const { registros } = transformarRespuesta("sevilla", "Sevilla", conProblemas)
    expect(registros[1].temperatura_c).toBeNull()
    expect(registros[2].humedad_pct).toBe("")
    expect(registros[3].precipitacion_mm).toBe("0.4")
  })
})

describe("limpieza", () => {
  const { registros } = transformarRespuesta("sevilla", "Sevilla", conProblemas)
  const { validos, rechazados } = limpiar(registros)
  const motivosDe = (indice: number) =>
    rechazados.find((r) => r.registro.indice === indice)?.motivos.join(" | ")

  it("rechaza nulos y vacíos en lugar de convertirlos en 0", () => {
    expect(validos.some((v) => v.temperatura_c === 0)).toBe(false)
    expect(motivosDe(1)).toMatch(/temperatura válida \(null\)/)
    expect(motivosDe(2)).toMatch(/humedad válida \(cadena vacía\)/)
    expect(motivosDe(3)).toMatch(/precipitación válida \(texto «0.4»\)/)
    expect(motivosDe(9)).toMatch(/temperatura válida \(NaN\)/)
  })

  it("valida rangos de humedad y precipitación", () => {
    expect(motivosDe(4)).toMatch(/Humedad fuera de 0–100/)
    expect(motivosDe(5)).toMatch(/Precipitación negativa/)
  })

  it("rechaza fechas inválidas o ausentes", () => {
    expect(motivosDe(7)).toMatch(/Fecha no válida/)
    expect(motivosDe(8)).toMatch(/Fecha no válida \(null\)/)
  })

  it("conserva temperaturas extremas", () => {
    expect(validos.map((v) => v.temperatura_c)).toEqual([10, -60.5])
    expect(validos.find((v) => v.temperatura_c === -60.5)?.humedad_pct).toBe(0)
  })

  it("registra un motivo por cada fila rechazada", () => {
    expect(validos.length + rechazados.length).toBe(registros.length)
    expect(rechazados.every((r) => r.motivos.length > 0)).toBe(true)
  })

  it("rechaza registros sin ciudad", () => {
    const sinCiudad = transformarRespuesta("x", null, diaCompleto).registros
    const r = limpiar(sinCiudad)
    expect(r.validos).toHaveLength(0)
    expect(r.rechazados[0].motivos).toContain("Sin ciudad")
  })

  it("elimina duplicados conservando la primera aparición válida", () => {
    const t = transformarRespuesta("barcelona", "Barcelona", conDuplicados).registros
    const r = limpiar(t)
    expect(r.duplicados).toBe(2)
    expect(r.validos.map((v) => [v.fecha_hora, v.temperatura_c])).toEqual([
      ["2026-09-01T00:00:00Z", 10], // posición 0; la 2 es duplicado
      ["2026-09-01T01:00:00Z", 12], // la posición 1 tenía null, se conserva la 3
    ])
    const dup = r.rechazados.filter((x) => x.motivos[0].startsWith("Duplicado"))
    expect(dup.map((x) => x.registro.indice)).toEqual([2, 4])
    expect(dup[0].motivos[0]).toMatch(/se conserva barcelona#0/)
  })

  it("no duplica datos de la misma ciudad si se combina dos veces la misma respuesta", () => {
    const a = transformarRespuesta("barcelona", "Barcelona", diaCompleto).registros
    const r = limpiar([...a, ...a])
    expect(r.validos).toHaveLength(24)
    expect(r.duplicados).toBe(24)
  })
})

describe("validación del periodo", () => {
  const ahora = new Date("2026-10-26T12:00:00Z")
  it("acepta septiembre de 2026 (30 días)", () => {
    expect(validarPeriodo("2026-09-01", "2026-09-30", ahora)).toMatchObject({ errores: [], dias: 30 })
  })
  it("limita a 31 días", () => {
    expect(validarPeriodo("2026-08-01", "2026-08-31", ahora).errores).toEqual([])
    expect(validarPeriodo("2026-08-01", "2026-09-01", ahora).errores[0]).toMatch(/31 días/)
  })
  it("rechaza fechas invertidas, imposibles o futuras", () => {
    expect(validarPeriodo("2026-09-10", "2026-09-01", ahora).errores).toHaveLength(1)
    expect(validarPeriodo("2026-02-30", "2026-03-01", ahora).errores[0]).toMatch(/inicial no es válida/)
    expect(validarPeriodo("2026-10-20", "2026-10-27", ahora).errores[0]).toMatch(/posterior a hoy/)
  })
  it("avisa del retraso de publicación del archivo", () => {
    expect(validarPeriodo("2026-10-20", "2026-10-25", ahora).avisos).toHaveLength(1)
  })
})
