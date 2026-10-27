import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { datetimeLocalAUtc } from "@/lib/etl/filtros"
import { respuestaError } from "@/lib/servidor/peticion"
import { mensajeError, obtenerSupabase, TABLA_MEDICIONES } from "@/lib/supabase/servidor"

const CAMPOS_ORDEN = new Set([
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
])
const TAMANOS = new Set([25, 50, 100])

/** Lectura paginada de lo que realmente está persistido en Supabase. */
export async function GET(request: NextRequest) {
  const supabase = obtenerSupabase()
  if (!supabase.ok)
    return respuestaError(503, `Faltan variables de entorno: ${supabase.faltan.join(", ")}.`)

  const p = request.nextUrl.searchParams
  const ciudad = p.get("ciudad") ?? ""
  const desde = p.get("desde") ?? ""
  const hasta = p.get("hasta") ?? ""
  const campo = p.get("orden") ?? "fecha_hora"
  const ascendente = p.get("direccion") !== "desc"
  const pagina = Math.max(1, Math.floor(Number(p.get("pagina") ?? "1")) || 1)
  const tamano = Number(p.get("tamano") ?? "25")

  if (ciudad && !NOMBRES_CIUDADES.has(ciudad)) return respuestaError(400, "Ciudad no reconocida.")
  if (!CAMPOS_ORDEN.has(campo)) return respuestaError(400, "Campo de ordenación no válido.")
  if (!TAMANOS.has(tamano)) return respuestaError(400, "Tamaño de página no válido.")
  const desdeUtc = desde ? datetimeLocalAUtc(desde) : null
  const hastaUtc = hasta ? datetimeLocalAUtc(hasta) : null
  if ((desde && !desdeUtc) || (hasta && !hastaUtc))
    return respuestaError(400, "Fechas no válidas (AAAA-MM-DDTHH:MM, UTC).")

  let consulta = supabase.cliente
    .from(TABLA_MEDICIONES)
    .select("id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en", {
      count: "exact",
    })
  if (ciudad) consulta = consulta.eq("ciudad", ciudad)
  if (desdeUtc) consulta = consulta.gte("fecha_hora", desdeUtc)
  if (hastaUtc) consulta = consulta.lte("fecha_hora", hastaUtc)

  // La base de datos no garantiza ningún orden: se pide explícitamente (ORDER BY).
  const inicio = (pagina - 1) * tamano
  const { data, error, count } = await consulta
    .order(campo, { ascending: ascendente })
    .order("id", { ascending: true })
    .range(inicio, inicio + tamano - 1)

  if (error) {
    // Pedir una página más allá del final devuelve 416 en PostgREST.
    if (error.code === "PGRST103") return Response.json({ ok: true, filas: [], total: count ?? 0 })
    return respuestaError(502, mensajeError(error))
  }
  return Response.json({ ok: true, filas: data, total: count ?? 0 })
}
