import {
  escrituraPermitida,
  mensajeError,
  obtenerSupabase,
  TABLA_MEDICIONES,
} from "@/lib/supabase/servidor"

/** Comprueba configuración y existencia de la tabla sin exponer credenciales. */
export async function GET() {
  const supabase = obtenerSupabase()
  if (!supabase.ok)
    return Response.json({
      configurado: false,
      tablaDisponible: false,
      escrituraPermitida: escrituraPermitida(),
      mensaje: `Faltan variables de entorno: ${supabase.faltan.join(", ")}.`,
    })

  // Sin head: true, porque una petición HEAD no trae cuerpo y oculta el error de tabla inexistente.
  const { error, count } = await supabase.cliente
    .from(TABLA_MEDICIONES)
    .select("id", { count: "exact" })
    .limit(1)
  return Response.json({
    configurado: true,
    tablaDisponible: !error,
    escrituraPermitida: escrituraPermitida(),
    filas: error ? null : count,
    mensaje: error ? mensajeError(error) : null,
  })
}
