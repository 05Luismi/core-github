import { describe, expect, it } from "vitest"

import { congelar, crearLotes, ejecutarLotes, verificarClaves, type EnviarLote } from "@/lib/etl/carga"
import { buscarCiudad } from "@/lib/etl/ciudades"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarRespuesta } from "@/lib/etl/transformacion"

/**
 * Integración con Supabase a través de los endpoints de la app (que es quien
 * tiene la secret key). Requiere el servidor en marcha y la migración aplicada:
 *   ETL_BASE_URL=http://localhost:3000 INTEGRACION=1 npm run test:integracion
 * Escribe datos reales de Open-Meteo (Bilbao, 2026-09-01 y 02) en la tabla.
 */
const BASE = process.env.ETL_BASE_URL

async function post(ruta: string, cuerpo: unknown) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  })
  return { status: res.status, datos: await res.json() }
}

const enviar: EnviarLote = async (registros) => {
  const { status, datos } = await post("/api/supabase/cargar", { registros })
  return datos.ok ? { ok: true, procesados: datos.procesados } : { ok: false, error: `${status}: ${datos.error}` }
}

async function contar(): Promise<number> {
  const res = await fetch(
    `${BASE}/api/supabase/datos?ciudad=Bilbao&desde=2026-09-01T00:00&hasta=2026-09-02T23:00&tamano=25`
  )
  const d = await res.json()
  if (!d.ok) throw new Error(d.error)
  return d.total
}

describe.skipIf(!process.env.INTEGRACION || !BASE)("Supabase vía API", () => {
  let registros: ReturnType<typeof congelar> = []

  it("prepara 48 registros reales", async () => {
    const res = await fetch(`${BASE}/api/open-meteo?ciudad=bilbao&inicio=2026-09-01&fin=2026-09-02`)
    const d = await res.json()
    const ciudad = buscarCiudad("bilbao")!
    const { validos } = limpiar(transformarRespuesta(ciudad.id, ciudad.nombre, d.json).registros)
    registros = congelar(validos)
    expect(registros).toHaveLength(48)
  })

  it("primera carga + segunda carga sin duplicados", async () => {
    const lotes = crearLotes(registros, 20)
    const r1 = await ejecutarLotes(lotes, lotes.map((l) => l.numero), enviar, () => {})
    expect(r1.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(await contar()).toBe(48)

    const r2 = await ejecutarLotes(crearLotes(registros, 20), [1, 2, 3], enviar, () => {})
    expect(r2.every((l) => l.estado === "completado")).toBe(true)
    expect(await contar()).toBe(48)

    const v = await verificarClaves(registros, async (claves) => {
      const { datos } = await post("/api/supabase/verificar", { claves })
      return datos.ok ? { ok: true, existentes: datos.existentes } : { ok: false, error: datos.error }
    })
    expect(v).toMatchObject({ comprobados: 48, encontrados: 48, faltantes: [], errores: [] })
  })

  it("fallo parcial real: un lote inválido falla, los demás persisten y se puede reintentar", async () => {
    // El lote 2 lleva una humedad imposible: el servidor lo rechaza con 422 sin escribir nada.
    const corrupto = registros.map((r, i) => (i === 25 ? { ...r, humedad_pct: 150 } : r))
    const lotes = crearLotes(corrupto, 20)
    const r = await ejecutarLotes(lotes, [1, 2, 3], enviar, () => {})
    expect(r.map((l) => l.estado)).toEqual(["completado", "error", "completado"])
    expect(r[1].error).toMatch(/^422/)

    // Reintento del lote fallido ya corregido: solo se reenvía ese lote.
    const corregido = r.map((l) => (l.numero === 2 ? { ...l, registros: registros.slice(20, 40) } : l))
    const r2 = await ejecutarLotes(corregido, [2], enviar, () => {})
    expect(r2.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(r2[0].intentos).toBe(1)
    expect(await contar()).toBe(48)
  })

  it("el servidor valida tamaño y contenido", async () => {
    const demasiados = Array.from({ length: 501 }, () => registros[0])
    expect((await post("/api/supabase/cargar", { registros: demasiados })).status).toBe(400)
    const repetidos = [registros[0], registros[0]]
    expect((await post("/api/supabase/cargar", { registros: repetidos })).status).toBe(422)
    const res = await fetch(`${BASE}/api/supabase/cargar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(300 * 1024),
    })
    expect(res.status).toBe(413)
  })
})
