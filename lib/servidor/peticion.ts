import "server-only"

/** 500 registros ocupan unos 60 KB en JSON; el margen evita rechazar lotes legítimos. */
export const TAMANO_MAXIMO_CUERPO = 256 * 1024

export function respuestaError(estado: number, error: string, extra?: object) {
  return Response.json({ ok: false, error, ...extra }, { status: estado })
}

/** Lee el cuerpo JSON comprobando el tamaño real, no solo la cabecera declarada. */
export async function leerJsonLimitado(
  request: Request,
  maximo = TAMANO_MAXIMO_CUERPO
): Promise<{ ok: true; datos: unknown } | { ok: false; respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > maximo)
    return {
      ok: false,
      respuesta: respuestaError(413, `La petición supera ${maximo / 1024} KB.`),
    }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > maximo)
    return {
      ok: false,
      respuesta: respuestaError(413, `La petición supera ${maximo / 1024} KB.`),
    }
  try {
    return { ok: true, datos: JSON.parse(texto) }
  } catch {
    return { ok: false, respuesta: respuestaError(400, "El cuerpo no es JSON válido.") }
  }
}
