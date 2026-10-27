import { describe, expect, it } from "vitest"

import { buscarCiudad } from "@/lib/etl/ciudades"
import { construirUrlOpenMeteo } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarRespuesta } from "@/lib/etl/transformacion"

const BASE = process.env.ETL_BASE_URL

/** Extracción real: una ciudad, un día. Requiere red. */
describe.skipIf(!process.env.INTEGRACION)("Open-Meteo real", () => {
  it("Barcelona, 2026-09-01: 24 registros horarios en UTC", async () => {
    const ciudad = buscarCiudad("barcelona")!
    const res = await fetch(construirUrlOpenMeteo(ciudad, "2026-09-01", "2026-09-01"))
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.utc_offset_seconds).toBe(0)
    expect(json.hourly_units).toMatchObject({
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      precipitation: "mm",
    })
    const { registros, incidencias } = transformarRespuesta(ciudad.id, ciudad.nombre, json)
    expect(incidencias).toEqual([])
    expect(registros).toHaveLength(24)
    expect(registros.map((r) => r.fecha_hora)).toEqual(
      Array.from({ length: 24 }, (_, h) => `2026-09-01T${String(h).padStart(2, "0")}:00:00Z`)
    )
    const { validos } = limpiar(registros)
    expect(validos).toHaveLength(24)
  })

  it.skipIf(!BASE)("el endpoint del servidor rechaza más de 31 días", async () => {
    const res = await fetch(`${BASE}/api/open-meteo?ciudad=madrid&inicio=2026-08-01&fin=2026-09-01`)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/31 días/)
  })

  it.skipIf(!BASE)("el endpoint del servidor devuelve el JSON original", async () => {
    const res = await fetch(`${BASE}/api/open-meteo?ciudad=sevilla&inicio=2026-09-01&fin=2026-09-01`)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d.json.hourly.time).toHaveLength(24)
    expect(d.url).toContain("timezone=GMT")
  })
})
