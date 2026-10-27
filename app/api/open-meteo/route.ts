import type { NextRequest } from "next/server"

import { buscarCiudad } from "@/lib/etl/ciudades"
import { construirUrlOpenMeteo, validarPeriodo } from "@/lib/etl/extraccion"
import { respuestaError } from "@/lib/servidor/peticion"

/**
 * Extracción de una ciudad. El servidor repite las validaciones del formulario
 * (límite de 31 días incluido) y devuelve el JSON de Open-Meteo sin modificar.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ciudad = buscarCiudad(params.get("ciudad") ?? "")
  const inicio = params.get("inicio") ?? ""
  const fin = params.get("fin") ?? ""
  if (!ciudad) return respuestaError(400, "Ciudad no reconocida.")
  const { errores } = validarPeriodo(inicio, fin)
  if (errores.length) return respuestaError(400, errores.join(" "))

  const url = construirUrlOpenMeteo(ciudad, inicio, fin)
  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    const motivo =
      e instanceof Error && e.name === "TimeoutError"
        ? "Open-Meteo no respondió en 20 s."
        : "No se pudo conectar con Open-Meteo."
    return respuestaError(502, motivo, { url })
  }

  const texto = await respuesta.text()
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return respuestaError(502, `Open-Meteo devolvió una respuesta no JSON (HTTP ${respuesta.status}).`, { url })
  }
  if (!respuesta.ok) {
    const razon =
      typeof json === "object" && json !== null && "reason" in json
        ? String((json as { reason: unknown }).reason)
        : `HTTP ${respuesta.status}`
    return respuestaError(502, `Open-Meteo rechazó la petición: ${razon}`, { url })
  }
  return Response.json({ ok: true, url, json })
}
