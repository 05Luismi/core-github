import { describe, expect, it } from "vitest"

import { aCsv, colorRampa, RAMPA_SECUENCIAL, resumirPorCiudad, serieCiudad } from "@/lib/etl/resumen-ciudades"
import type { RegistroMedicion } from "@/lib/etl/tipos"

const r = (ciudad: string, hora: number, t: number, h: number, p: number): RegistroMedicion => ({
  ciudad,
  fecha_hora: `2026-09-01T${String(hora).padStart(2, "0")}:00:00.000Z`,
  temperatura_c: t,
  humedad_pct: h,
  precipitacion_mm: p,
})

describe("resumirPorCiudad", () => {
  it("agrega medias, extremos, total y horas con lluvia por ciudad", () => {
    const res = resumirPorCiudad([r("Madrid", 0, 10, 40, 0), r("Madrid", 1, 20, 60, 1.5), r("Bilbao", 0, 15, 90, 0.2)])
    expect(res.get("Madrid")).toEqual({
      horas: 2,
      temperaturaMedia: 15,
      temperaturaMin: 10,
      temperaturaMax: 20,
      humedadMedia: 50,
      precipitacionTotal: 1.5,
      horasConLluvia: 1,
    })
    expect(res.get("Bilbao")?.horas).toBe(1)
    expect(res.has("Sevilla")).toBe(false)
  })

  it("devuelve un mapa vacío sin registros", () => {
    expect(resumirPorCiudad([]).size).toBe(0)
  })
})

describe("serieCiudad", () => {
  it("filtra por ciudad y ordena por fecha sin modificar la entrada", () => {
    const entrada = [r("Madrid", 2, 1, 1, 0), r("Bilbao", 0, 1, 1, 0), r("Madrid", 0, 1, 1, 0)]
    const serie = serieCiudad(entrada, "Madrid")
    expect(serie.map((x) => x.fecha_hora.slice(11, 13))).toEqual(["00", "02"])
    expect(entrada[0].fecha_hora.slice(11, 13)).toBe("02")
  })
})

describe("colorRampa", () => {
  it("recorre la rampa de claro a oscuro y recorta fuera de rango", () => {
    expect(colorRampa(0)).toBe(RAMPA_SECUENCIAL[0])
    expect(colorRampa(1)).toBe(RAMPA_SECUENCIAL.at(-1))
    expect(colorRampa(-5)).toBe(RAMPA_SECUENCIAL[0])
    expect(colorRampa(Number.NaN)).toBe(RAMPA_SECUENCIAL[0])
  })
})

describe("aCsv", () => {
  it("genera cabecera, punto decimal y escapa comas y comillas", () => {
    const csv = aCsv([r("Madrid", 0, 12.5, 40, 0), { ...r("Ciudad, \"X\"", 1, -1, 2, 3) }])
    expect(csv.split("\n")).toEqual([
      "ciudad,fecha_hora,temperatura_c,humedad_pct,precipitacion_mm",
      "Madrid,2026-09-01T00:00:00.000Z,12.5,40,0",
      '"Ciudad, ""X""",2026-09-01T01:00:00.000Z,-1,2,3',
      "",
    ])
  })
})
