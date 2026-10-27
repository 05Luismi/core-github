import { describe, expect, it } from "vitest"

import {
  congelar,
  crearLotes,
  ejecutarLotes,
  huellaConjunto,
  verificarClaves,
  type EnviarLote,
} from "@/lib/etl/carga"
import {
  calcularConjuntoCarga,
  formularioFiltrosVacio,
  interpretarFiltros,
  paginar,
  type Orden,
} from "@/lib/etl/filtros"
import { claveRegistro, type RegistroMedicion, type RegistroValido } from "@/lib/etl/tipos"
import { validarRegistroMedicion } from "@/lib/etl/validacion"

const NOMBRES = ["Barcelona", "Madrid", "Sevilla", "Bilbao", "Valencia"]

/** 2 ciudades × 3 días × 24 h = 144 registros válidos deterministas. */
function generarValidos(): RegistroValido[] {
  const filas: RegistroValido[] = []
  for (const [c, ciudad] of ["Madrid", "Barcelona"].entries())
    for (let h = 0; h < 72; h++) {
      const fecha_hora = new Date(Date.UTC(2026, 8, 1, h)).toISOString().replace(".000Z", "Z")
      filas.push({
        clave: claveRegistro(ciudad, fecha_hora),
        uid: `${ciudad}#${h}`,
        ciudad,
        fecha_hora,
        temperatura_c: 15 + ((h * 7 + c * 3) % 20),
        humedad_pct: 40 + ((h * 3) % 60),
        precipitacion_mm: h % 10 === 0 ? 0.5 + c : 0,
      })
    }
  return filas
}

const validos = generarValidos()
const filtrosDe = (cambio: Partial<ReturnType<typeof formularioFiltrosVacio>>) =>
  interpretarFiltros({ ...formularioFiltrosVacio(NOMBRES), ...cambio }, NOMBRES).filtros
const sinFiltros = filtrosDe({})
const porTemperaturaDesc: Orden = { campo: "temperatura_c", direccion: "desc" }

describe("filtros y ordenación antes de paginar", () => {
  it("ordena el conjunto completo y después pagina", () => {
    const { coincidentes } = calcularConjuntoCarga(validos, sinFiltros, porTemperaturaDesc, new Set())
    const maxGlobal = Math.max(...validos.map((v) => v.temperatura_c))
    const pagina2 = paginar(coincidentes, 2, 25).filas
    expect(coincidentes[0].temperatura_c).toBe(maxGlobal)
    // Todo lo de la página 2 es <= lo de la página 1.
    const minPagina1 = Math.min(...paginar(coincidentes, 1, 25).filas.map((r) => r.temperatura_c))
    expect(pagina2.every((r) => r.temperatura_c <= minPagina1)).toBe(true)
  })

  it("filtra por ciudad, intervalo UTC y rangos", () => {
    const f = filtrosDe({
      ciudades: ["Madrid"],
      desde: "2026-09-02T00:00",
      hasta: "2026-09-02T23:00",
      humedadMin: "50",
      temperaturaMax: "30",
    })
    const { coincidentes } = calcularConjuntoCarga(validos, f, { campo: "fecha_hora", direccion: "asc" }, new Set())
    expect(coincidentes.length).toBeGreaterThan(0)
    for (const r of coincidentes) {
      expect(r.ciudad).toBe("Madrid")
      expect(r.fecha_hora >= "2026-09-02T00:00:00Z" && r.fecha_hora <= "2026-09-02T23:00:00Z").toBe(true)
      expect(r.humedad_pct).toBeGreaterThanOrEqual(50)
      expect(r.temperatura_c).toBeLessThanOrEqual(30)
    }
  })

  it("«solo lluvia» exige precipitación > 0 y acepta coma decimal", () => {
    const lluvia = calcularConjuntoCarga(validos, filtrosDe({ soloLluvia: true }), porTemperaturaDesc, new Set())
    expect(lluvia.coincidentes.every((r) => r.precipitacion_mm > 0)).toBe(true)
    const coma = calcularConjuntoCarga(validos, filtrosDe({ precipitacionMin: "1,5" }), porTemperaturaDesc, new Set())
    expect(coma.coincidentes.every((r) => r.ciudad === "Barcelona")).toBe(true)
  })

  it("informa de valores no numéricos y rangos invertidos", () => {
    const { errores } = interpretarFiltros(
      { ...formularioFiltrosVacio(NOMBRES), temperaturaMin: "abc", humedadMin: "80", humedadMax: "20" },
      NOMBRES
    )
    expect(errores).toHaveLength(2)
  })
})

describe("selección entre páginas", () => {
  it("selecciona filas de varias páginas y solo carga las que cumplen los filtros", () => {
    const orden: Orden = { campo: "fecha_hora", direccion: "asc" }
    const { coincidentes } = calcularConjuntoCarga(validos, sinFiltros, orden, new Set())
    const p1 = paginar(coincidentes, 1, 25).filas.slice(0, 3)
    const p4 = paginar(coincidentes, 4, 25).filas.slice(0, 2)
    const seleccion = new Set([...p1, ...p4].map((r) => r.clave))

    const todo = calcularConjuntoCarga(validos, sinFiltros, orden, seleccion)
    expect(todo.aCargar).toHaveLength(5)
    expect(todo.seleccionadosFuera).toBe(0)

    // Al filtrar a Madrid, las seleccionadas de Barcelona quedan fuera y no se suben.
    const madrid = calcularConjuntoCarga(validos, filtrosDe({ ciudades: ["Madrid"] }), orden, seleccion)
    const deMadrid = [...p1, ...p4].filter((r) => r.ciudad === "Madrid").length
    expect(madrid.aCargar).toHaveLength(deMadrid)
    expect(madrid.seleccionadosFuera).toBe(5 - deMadrid)
  })

  it("«seleccionar todas las filtradas» abarca todas las páginas", () => {
    const f = filtrosDe({ ciudades: ["Barcelona"] })
    const { coincidentes } = calcularConjuntoCarga(validos, f, porTemperaturaDesc, new Set())
    const seleccion = new Set(coincidentes.map((r) => r.clave))
    const r = calcularConjuntoCarga(validos, f, porTemperaturaDesc, seleccion)
    expect(r.aCargar).toHaveLength(72)
    expect(paginar(r.aCargar, 1, 25).totalPaginas).toBe(3)
  })

  it("cambiar los filtros no selecciona registros nuevos", () => {
    const seleccion = new Set([validos[0].clave])
    const r = calcularConjuntoCarga(validos, filtrosDe({ ciudades: ["Barcelona"] }), porTemperaturaDesc, seleccion)
    expect(r.aCargar).toHaveLength(0)
    const r2 = calcularConjuntoCarga(validos, sinFiltros, porTemperaturaDesc, seleccion)
    expect(r2.aCargar.map((x) => x.clave)).toEqual([validos[0].clave])
  })

  it("la vista previa conserva el orden elegido", () => {
    const seleccion = new Set(validos.map((v) => v.clave))
    const r = calcularConjuntoCarga(validos, sinFiltros, porTemperaturaDesc, seleccion)
    for (let i = 1; i < r.aCargar.length; i++)
      expect(r.aCargar[i - 1].temperatura_c).toBeGreaterThanOrEqual(r.aCargar[i].temperatura_c)
  })
})

describe("carga por lotes", () => {
  const seleccion = new Set(validos.map((v) => v.clave))
  const vista = calcularConjuntoCarga(validos, sinFiltros, porTemperaturaDesc, seleccion).aCargar

  it("envía exactamente la vista previa, en el mismo orden, en lotes de ≤ 500", async () => {
    const enviados: RegistroMedicion[][] = []
    const enviar: EnviarLote = async (r) => {
      enviados.push(r)
      return { ok: true, procesados: r.length }
    }
    const congelados = congelar(vista)
    const lotes = crearLotes(congelados, 50)
    const finales = await ejecutarLotes(lotes, lotes.map((l) => l.numero), enviar, () => {})
    expect(enviados.map((l) => l.length)).toEqual([50, 50, 44])
    const plano = enviados.flat()
    expect(plano.map((r) => r.fecha_hora + r.ciudad)).toEqual(vista.map((r) => r.fecha_hora + r.ciudad))
    expect(huellaConjunto(plano)).toBe(huellaConjunto(vista))
    // Solo columnas de destino, y todas superan la validación del servidor.
    expect(Object.keys(plano[0]).sort()).toEqual(
      ["ciudad", "fecha_hora", "humedad_pct", "precipitacion_mm", "temperatura_c"]
    )
    expect(plano.every((r) => validarRegistroMedicion(r).ok)).toBe(true)
    expect(finales.every((l) => l.estado === "completado")).toBe(true)
    expect(crearLotes(congelar(validos)).every((l) => l.registros.length <= 500)).toBe(true)
  })

  it("la copia congelada no cambia si después cambia la selección", () => {
    const congelados = congelar(vista)
    const huella = huellaConjunto(congelados)
    const otra = calcularConjuntoCarga(validos, filtrosDe({ ciudades: ["Madrid"] }), porTemperaturaDesc, seleccion)
    expect(otra.aCargar.length).toBeLessThan(vista.length)
    expect(huellaConjunto(congelados)).toBe(huella)
    expect(Object.isFrozen(congelados[0])).toBe(true)
  })

  it("un fallo parcial conserva los lotes anteriores y permite reintentar solo los fallidos", async () => {
    const llamadas: number[] = []
    let fallar = true
    const enviar: EnviarLote = async (r) => {
      const lote = Math.floor(vista.findIndex((v) => v.clave === claveRegistro(r[0].ciudad, r[0].fecha_hora)) / 50) + 1
      llamadas.push(lote)
      if (lote === 2 && fallar) return { ok: false, error: "Error simulado del servidor (HTTP 502)" }
      return { ok: true, procesados: r.length }
    }
    const lotes = crearLotes(congelar(vista), 50)
    const tras1 = await ejecutarLotes(lotes, [1, 2, 3], enviar, () => {})
    expect(tras1.map((l) => l.estado)).toEqual(["completado", "error", "completado"])
    expect(tras1[1].error).toMatch(/simulado/)
    expect(tras1[0].procesados).toBe(50)

    fallar = false
    const fallidos = tras1.filter((l) => l.estado === "error").map((l) => l.numero)
    const tras2 = await ejecutarLotes(tras1, fallidos, enviar, () => {})
    expect(llamadas).toEqual([1, 2, 3, 2])
    expect(tras2.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(tras2[1].intentos).toBe(2)
    expect(tras2[0].intentos).toBe(1)
  })

  it("una excepción de red marca el lote como error sin detener los demás", async () => {
    const lotes = crearLotes(congelar(vista), 100)
    const finales = await ejecutarLotes(lotes, [1, 2], async (r) => {
      if (r.length === 100) throw new Error("fetch failed")
      return { ok: true, procesados: r.length }
    }, () => {})
    expect(finales.map((l) => l.estado)).toEqual(["error", "completado"])
  })

  it("verifica por lotes qué claves existen en destino", async () => {
    const destino = new Set(vista.slice(0, 140).map((r) => claveRegistro(r.ciudad, r.fecha_hora)))
    const tamanos: number[] = []
    const res = await verificarClaves(vista, async (claves) => {
      tamanos.push(claves.length)
      return { ok: true, existentes: claves.map((c) => claveRegistro(c.ciudad, c.fecha_hora)).filter((k) => destino.has(k)) }
    }, 100)
    expect(tamanos).toEqual([100, 44])
    expect(res.encontrados).toBe(140)
    expect(res.faltantes).toHaveLength(4)
  })
})

describe("validación en servidor", () => {
  const base = { ciudad: "Madrid", fecha_hora: "2026-09-01T00:00:00Z", temperatura_c: 20, humedad_pct: 50, precipitacion_mm: 0 }
  it("acepta un registro correcto", () => {
    expect(validarRegistroMedicion(base).ok).toBe(true)
  })
  it.each([
    [{ ...base, ciudad: "Lisboa" }, /Ciudad/],
    [{ ...base, fecha_hora: "2026-09-01T00:30:00Z" }, /hora exacta/],
    [{ ...base, fecha_hora: "2026-09-01 00:00" }, /hora exacta/],
    [{ ...base, temperatura_c: null }, /temperatura/],
    [{ ...base, humedad_pct: "50" }, /humedad/],
    [{ ...base, humedad_pct: 101 }, /0–100/],
    [{ ...base, precipitacion_mm: -1 }, /negativa/],
    [{ ...base, id: 5 }, /no permitidos/],
  ])("rechaza %o", (registro, motivo) => {
    const r = validarRegistroMedicion(registro)
    expect(r.ok).toBe(false)
    expect(r.motivos.join(" ")).toMatch(motivo)
  })
})
