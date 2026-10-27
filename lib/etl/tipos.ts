/** Registro tras la transformación: un registro por ciudad y hora, con los valores tal y como llegaron. */
export type RegistroTransformado = {
  /** Identificador de origen: ciudad + posición en los arrays de la respuesta. */
  uid: string
  ciudadId: string
  ciudad: string | null
  indice: number
  /** Fecha normalizada a ISO 8601 UTC, o null si no se pudo interpretar. */
  fecha_hora: string | null
  fecha_original: unknown
  // Los valores se conservan sin convertir: null, "" o ausente siguen siéndolo.
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
  /** Problemas detectados al combinar los arrays (longitudes, offset...). */
  incidencias: string[]
}

/** Estructura normalizada que se envía a Supabase. */
export type RegistroMedicion = {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type RegistroValido = RegistroMedicion & {
  /** Clave natural ciudad|fecha_hora, coincide con la restricción única en destino. */
  clave: string
  uid: string
}

export type RegistroRechazado = {
  registro: RegistroTransformado
  motivos: string[]
}

export function claveRegistro(ciudad: string, fechaHora: string): string {
  return `${ciudad}|${fechaHora}`
}
