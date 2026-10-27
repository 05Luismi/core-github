import { TAMANO_LOTE } from "@/lib/etl/carga"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { claveRegistro } from "@/lib/etl/tipos"
import { formatearUtc } from "@/lib/etl/transformacion"
import { esFechaHoraUtcValida } from "@/lib/etl/validacion"
import { leerJsonLimitado, respuestaError } from "@/lib/servidor/peticion"
import { mensajeError, obtenerSupabase, TABLA_MEDICIONES } from "@/lib/supabase/servidor"

/** Mantiene la URL de cada consulta GET a PostgREST en un tamaño razonable. */
const CLAVES_POR_CONSULTA = 100

/** Devuelve cuáles de las claves recibidas existen en la tabla de destino. */
export async function POST(request: Request) {
  const supabase = obtenerSupabase()
  if (!supabase.ok)
    return respuestaError(503, `Faltan variables de entorno: ${supabase.faltan.join(", ")}.`)

  const cuerpo = await leerJsonLimitado(request)
  if (!cuerpo.ok) return cuerpo.respuesta
  const claves = (cuerpo.datos as { claves?: unknown })?.claves
  if (!Array.isArray(claves) || claves.length === 0 || claves.length > TAMANO_LOTE)
    return respuestaError(400, `Se esperaban entre 1 y ${TAMANO_LOTE} claves.`)

  const porCiudad = new Map<string, string[]>()
  for (const c of claves) {
    const { ciudad, fecha_hora } = (c ?? {}) as Record<string, unknown>
    if (typeof ciudad !== "string" || !NOMBRES_CIUDADES.has(ciudad) || !esFechaHoraUtcValida(fecha_hora))
      return respuestaError(400, "Clave no válida en la petición.")
    porCiudad.set(ciudad, [...(porCiudad.get(ciudad) ?? []), fecha_hora])
  }

  const existentes: string[] = []
  for (const [ciudad, fechas] of porCiudad) {
    for (let i = 0; i < fechas.length; i += CLAVES_POR_CONSULTA) {
      const { data, error } = await supabase.cliente
        .from(TABLA_MEDICIONES)
        .select("ciudad, fecha_hora")
        .eq("ciudad", ciudad)
        .in("fecha_hora", fechas.slice(i, i + CLAVES_POR_CONSULTA))
      if (error) return respuestaError(502, mensajeError(error))
      for (const fila of data)
        existentes.push(claveRegistro(fila.ciudad, formatearUtc(Date.parse(fila.fecha_hora))))
    }
  }
  return Response.json({ ok: true, existentes })
}
