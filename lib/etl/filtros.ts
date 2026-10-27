import type { RegistroMedicion, RegistroValido } from "./tipos"

export type CampoOrden =
  | "ciudad"
  | "fecha_hora"
  | "temperatura_c"
  | "humedad_pct"
  | "precipitacion_mm"

export type Orden = { campo: CampoOrden; direccion: "asc" | "desc" }

/** Valores del formulario tal y como los escribe el usuario. */
export type FormularioFiltros = {
  ciudades: string[]
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
  soloLluvia: boolean
}

export type Filtros = {
  ciudades: ReadonlySet<string> | null
  desde: string | null
  hasta: string | null
  temperaturaMin: number | null
  temperaturaMax: number | null
  humedadMin: number | null
  humedadMax: number | null
  precipitacionMin: number | null
  precipitacionMax: number | null
  soloLluvia: boolean
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

export function formularioFiltrosVacio(ciudades: string[]): FormularioFiltros {
  return {
    ciudades,
    desde: "",
    hasta: "",
    temperaturaMin: "",
    temperaturaMax: "",
    humedadMin: "",
    humedadMax: "",
    precipitacionMin: "",
    precipitacionMax: "",
    soloLluvia: false,
  }
}

const PATRON_DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** Un input datetime-local no lleva zona: aquí se interpreta siempre como UTC. */
export function datetimeLocalAUtc(v: string): string | null {
  if (!PATRON_DATETIME_LOCAL.test(v)) return null
  const ms = Date.parse(`${v}:00Z`)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
}

function numero(v: string, etiqueta: string, errores: string[]): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  if (!Number.isFinite(n)) {
    errores.push(`${etiqueta}: «${v}» no es un número.`)
    return null
  }
  return n
}

/** Convierte el formulario en filtros; los campos con error no filtran. */
export function interpretarFiltros(
  f: FormularioFiltros,
  todasLasCiudades: string[]
): { filtros: Filtros; errores: string[] } {
  const errores: string[] = []
  const desde = f.desde ? datetimeLocalAUtc(f.desde) : null
  const hasta = f.hasta ? datetimeLocalAUtc(f.hasta) : null
  if (f.desde && !desde) errores.push("Desde: fecha y hora no válidas.")
  if (f.hasta && !hasta) errores.push("Hasta: fecha y hora no válidas.")
  if (desde && hasta && hasta < desde)
    errores.push("El intervalo de fechas está invertido: no coincidirá ningún registro.")

  const filtros: Filtros = {
    ciudades:
      f.ciudades.length === todasLasCiudades.length ? null : new Set(f.ciudades),
    desde,
    hasta,
    temperaturaMin: numero(f.temperaturaMin, "Temperatura mínima", errores),
    temperaturaMax: numero(f.temperaturaMax, "Temperatura máxima", errores),
    humedadMin: numero(f.humedadMin, "Humedad mínima", errores),
    humedadMax: numero(f.humedadMax, "Humedad máxima", errores),
    precipitacionMin: numero(f.precipitacionMin, "Precipitación mínima", errores),
    precipitacionMax: numero(f.precipitacionMax, "Precipitación máxima", errores),
    soloLluvia: f.soloLluvia,
  }
  const pares: [number | null, number | null, string][] = [
    [filtros.temperaturaMin, filtros.temperaturaMax, "temperatura"],
    [filtros.humedadMin, filtros.humedadMax, "humedad"],
    [filtros.precipitacionMin, filtros.precipitacionMax, "precipitación"],
  ]
  for (const [min, max, etiqueta] of pares)
    if (min !== null && max !== null && max < min)
      errores.push(`El rango de ${etiqueta} está invertido: no coincidirá ningún registro.`)

  return { filtros, errores }
}

export function cumpleFiltros(r: RegistroMedicion, f: Filtros): boolean {
  if (f.ciudades && !f.ciudades.has(r.ciudad)) return false
  if (f.desde && r.fecha_hora < f.desde) return false
  if (f.hasta && r.fecha_hora > f.hasta) return false
  if (f.temperaturaMin !== null && r.temperatura_c < f.temperaturaMin) return false
  if (f.temperaturaMax !== null && r.temperatura_c > f.temperaturaMax) return false
  if (f.humedadMin !== null && r.humedad_pct < f.humedadMin) return false
  if (f.humedadMax !== null && r.humedad_pct > f.humedadMax) return false
  if (f.precipitacionMin !== null && r.precipitacion_mm < f.precipitacionMin)
    return false
  if (f.precipitacionMax !== null && r.precipitacion_mm > f.precipitacionMax)
    return false
  if (f.soloLluvia && !(r.precipitacion_mm > 0)) return false
  return true
}

const comparadorTexto = new Intl.Collator("es")

function comparar(a: RegistroMedicion, b: RegistroMedicion, campo: CampoOrden) {
  if (campo === "ciudad") return comparadorTexto.compare(a.ciudad, b.ciudad)
  if (campo === "fecha_hora")
    return a.fecha_hora < b.fecha_hora ? -1 : a.fecha_hora > b.fecha_hora ? 1 : 0
  return a[campo] - b[campo]
}

/** Ordena sin mutar. Desempata por ciudad y fecha para que el orden sea determinista. */
export function ordenar<T extends RegistroMedicion>(registros: T[], orden: Orden): T[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

export type ConjuntoCarga = {
  /** Válidos que cumplen los filtros, ya ordenados (lo que muestra la tabla). */
  coincidentes: RegistroValido[]
  /** Seleccionados que siguen cumpliendo los filtros, en el orden elegido. */
  aCargar: RegistroValido[]
  /** Seleccionados que han quedado fuera de los filtros actuales: no se suben. */
  seleccionadosFuera: number
}

/** datos válidos → filtros → ordenación → selección. La paginación va después y solo afecta a la vista. */
export function calcularConjuntoCarga(
  validos: RegistroValido[],
  filtros: Filtros,
  orden: Orden,
  seleccion: ReadonlySet<string>
): ConjuntoCarga {
  const coincidentes = ordenar(
    validos.filter((r) => cumpleFiltros(r, filtros)),
    orden
  )
  const aCargar = coincidentes.filter((r) => seleccion.has(r.clave))
  return {
    coincidentes,
    aCargar,
    seleccionadosFuera: seleccion.size - aCargar.length,
  }
}

export function paginar<T>(filas: T[], pagina: number, tamano: number) {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / tamano))
  const actual = Math.min(Math.max(1, pagina), totalPaginas)
  return {
    filas: filas.slice((actual - 1) * tamano, actual * tamano),
    pagina: actual,
    totalPaginas,
    desde: filas.length ? (actual - 1) * tamano + 1 : 0,
    hasta: Math.min(actual * tamano, filas.length),
  }
}
