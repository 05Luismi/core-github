import { claveRegistro, type RegistroMedicion } from "./tipos"

export const TAMANO_LOTE = 500

export type EstadoLote = {
  numero: number
  /** Posiciones (base 1) dentro del conjunto congelado. */
  desde: number
  hasta: number
  registros: RegistroMedicion[]
  estado: "pendiente" | "enviando" | "completado" | "error"
  procesados: number | null
  error: string | null
  duracionMs: number | null
  intentos: number
}

export type RespuestaLote =
  | { ok: true; procesados: number }
  | { ok: false; error: string }

export type EnviarLote = (registros: RegistroMedicion[]) => Promise<RespuestaLote>

/** Copia profunda con solo las columnas de destino: lo que se congela al iniciar la carga. */
export function congelar(registros: RegistroMedicion[]): RegistroMedicion[] {
  return registros.map((r) =>
    Object.freeze({
      ciudad: r.ciudad,
      fecha_hora: r.fecha_hora,
      temperatura_c: r.temperatura_c,
      humedad_pct: r.humedad_pct,
      precipitacion_mm: r.precipitacion_mm,
    })
  )
}

export function crearLotes(
  registros: RegistroMedicion[],
  tamano = TAMANO_LOTE
): EstadoLote[] {
  const lotes: EstadoLote[] = []
  for (let i = 0; i < registros.length; i += tamano) {
    const parte = registros.slice(i, i + tamano)
    lotes.push({
      numero: lotes.length + 1,
      desde: i + 1,
      hasta: i + parte.length,
      registros: parte,
      estado: "pendiente",
      procesados: null,
      error: null,
      duracionMs: null,
      intentos: 0,
    })
  }
  return lotes
}

/**
 * Envía en orden los lotes indicados, de uno en uno. Un fallo no detiene los
 * siguientes ni altera los ya completados; quedan marcados para reintentar.
 */
export async function ejecutarLotes(
  lotes: EstadoLote[],
  numeros: number[],
  enviar: EnviarLote,
  alCambiar: (lotes: EstadoLote[]) => void,
  ahora: () => number = () => performance.now()
): Promise<EstadoLote[]> {
  let actuales = lotes
  const actualizar = (numero: number, cambio: Partial<EstadoLote>) => {
    actuales = actuales.map((l) => (l.numero === numero ? { ...l, ...cambio } : l))
    alCambiar(actuales)
  }
  for (const numero of numeros) {
    const lote = actuales.find((l) => l.numero === numero)
    if (!lote || lote.estado === "completado") continue
    actualizar(numero, { estado: "enviando", error: null, intentos: lote.intentos + 1 })
    const inicio = ahora()
    let respuesta: RespuestaLote
    try {
      respuesta = await enviar(lote.registros)
    } catch (e) {
      respuesta = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    const duracionMs = ahora() - inicio
    if (respuesta.ok)
      actualizar(numero, { estado: "completado", procesados: respuesta.procesados, duracionMs })
    else
      actualizar(numero, { estado: "error", procesados: null, error: respuesta.error, duracionMs })
  }
  return actuales
}

export type ResultadoVerificacion = {
  comprobados: number
  encontrados: number
  faltantes: string[]
  errores: string[]
}

export type ConsultarClaves = (
  claves: { ciudad: string; fecha_hora: string }[]
) => Promise<{ ok: true; existentes: string[] } | { ok: false; error: string }>

/** Comprueba por lotes que cada clave enviada existe en destino. */
export async function verificarClaves(
  registros: RegistroMedicion[],
  consultar: ConsultarClaves,
  tamano = TAMANO_LOTE
): Promise<ResultadoVerificacion> {
  const resultado: ResultadoVerificacion = {
    comprobados: 0,
    encontrados: 0,
    faltantes: [],
    errores: [],
  }
  for (let i = 0; i < registros.length; i += tamano) {
    const parte = registros.slice(i, i + tamano)
    const claves = parte.map((r) => ({ ciudad: r.ciudad, fecha_hora: r.fecha_hora }))
    const r = await consultar(claves)
    if (!r.ok) {
      resultado.errores.push(`Registros ${i + 1}–${i + parte.length}: ${r.error}`)
      continue
    }
    const existentes = new Set(r.existentes)
    resultado.comprobados += parte.length
    for (const c of claves) {
      const clave = claveRegistro(c.ciudad, c.fecha_hora)
      if (existentes.has(clave)) resultado.encontrados++
      else resultado.faltantes.push(clave)
    }
  }
  return resultado
}

/**
 * Huella FNV-1a de 32 bits del conjunto en su orden. Permite comprobar a
 * simple vista que la vista previa y lo enviado son exactamente lo mismo.
 */
export function huellaConjunto(registros: RegistroMedicion[]): string {
  let h = 0x811c9dc5
  for (const r of registros) {
    const texto = `${r.ciudad}|${r.fecha_hora}|${r.temperatura_c}|${r.humedad_pct}|${r.precipitacion_mm}\n`
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  return h.toString(16).padStart(8, "0")
}
