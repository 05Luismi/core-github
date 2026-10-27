import { TAMANO_LOTE } from "@/lib/etl/carga"
import { claveRegistro, type RegistroMedicion } from "@/lib/etl/tipos"
import { validarRegistroMedicion } from "@/lib/etl/validacion"
import { leerJsonLimitado, respuestaError } from "@/lib/servidor/peticion"
import {
  escrituraPermitida,
  mensajeError,
  obtenerSupabase,
  TABLA_MEDICIONES,
} from "@/lib/supabase/servidor"

/** Upsert de un lote. Todo el lote se valida antes de escribir nada. */
export async function POST(request: Request) {
  if (!escrituraPermitida())
    return respuestaError(
      403,
      "Escritura deshabilitada en producción: protege el endpoint y define ETL_PERMITIR_ESCRITURA=true."
    )
  const supabase = obtenerSupabase()
  if (!supabase.ok)
    return respuestaError(503, `Faltan variables de entorno: ${supabase.faltan.join(", ")}.`)

  const cuerpo = await leerJsonLimitado(request)
  if (!cuerpo.ok) return cuerpo.respuesta
  const registros = (cuerpo.datos as { registros?: unknown })?.registros
  if (!Array.isArray(registros) || registros.length === 0)
    return respuestaError(400, "Se esperaba { registros: [...] } con al menos un registro.")
  if (registros.length > TAMANO_LOTE)
    return respuestaError(400, `Máximo ${TAMANO_LOTE} registros por lote (recibidos ${registros.length}).`)

  const validos: RegistroMedicion[] = []
  const invalidos: { posicion: number; motivos: string[] }[] = []
  const claves = new Set<string>()
  registros.forEach((r, i) => {
    const v = validarRegistroMedicion(r)
    if (!v.ok || !v.registro) return void invalidos.push({ posicion: i + 1, motivos: v.motivos })
    const clave = claveRegistro(v.registro.ciudad, v.registro.fecha_hora)
    // Postgres no admite dos filas con la misma clave en un mismo upsert.
    if (claves.has(clave))
      return void invalidos.push({ posicion: i + 1, motivos: [`Clave repetida en el lote: ${clave}`] })
    claves.add(clave)
    validos.push(v.registro)
  })
  if (invalidos.length)
    return respuestaError(
      422,
      `El servidor rechazó el lote: ${invalidos.length} registros no superan la validación.`,
      { invalidos: invalidos.slice(0, 20) }
    )

  const { error, count } = await supabase.cliente
    .from(TABLA_MEDICIONES)
    .upsert(validos, { onConflict: "ciudad,fecha_hora", count: "exact" })
  if (error) return respuestaError(502, mensajeError(error))

  // PostgREST informa de filas afectadas, sin distinguir insertadas de actualizadas.
  return Response.json({ ok: true, procesados: count ?? validos.length, recuentoDeSupabase: count !== null })
}
