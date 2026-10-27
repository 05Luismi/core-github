import {
  claveRegistro,
  type RegistroRechazado,
  type RegistroTransformado,
  type RegistroValido,
} from "./tipos"
import { describirValor, validarMediciones } from "./validacion"

export type ResultadoLimpieza = {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
  duplicados: number
}

/**
 * Aplica las reglas de calidad y elimina duplicados.
 *
 * Duplicados: se identifican por (ciudad, fecha_hora). Se conserva la primera
 * aparición válida en el orden de extracción (orden de ciudades y, dentro de
 * cada respuesta, orden de los arrays); las siguientes se rechazan indicando
 * qué registro se conservó. Así un duplicado válido no queda oculto por una
 * aparición anterior que fuese rechazada por calidad.
 */
export function limpiar(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const vistos = new Map<string, string>()
  let duplicados = 0

  for (const r of registros) {
    const motivos: string[] = [...r.incidencias]
    if (!r.ciudad) motivos.push("Sin ciudad")
    if (r.fecha_hora === null)
      motivos.push(`Fecha no válida (${describirValor(r.fecha_original)})`)
    motivos.push(...validarMediciones(r))

    if (motivos.length) {
      rechazados.push({ registro: r, motivos })
      continue
    }

    const clave = claveRegistro(r.ciudad!, r.fecha_hora!)
    const conservado = vistos.get(clave)
    if (conservado !== undefined) {
      duplicados++
      rechazados.push({
        registro: r,
        motivos: [`Duplicado de ${r.ciudad} ${r.fecha_hora}: se conserva ${conservado}`],
      })
      continue
    }
    vistos.set(clave, r.uid)
    validos.push({
      clave,
      uid: r.uid,
      ciudad: r.ciudad!,
      fecha_hora: r.fecha_hora!,
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
    })
  }

  return { validos, rechazados, duplicados }
}
