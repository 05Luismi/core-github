"use client"

import * as React from "react"

import {
  congelar,
  crearLotes,
  ejecutarLotes,
  huellaConjunto,
  verificarClaves,
  type ConsultarClaves,
  type EnviarLote,
  type EstadoLote,
  type ResultadoVerificacion,
} from "@/lib/etl/carga"
import { buscarCiudad, CIUDADES } from "@/lib/etl/ciudades"
import {
  calcularConjuntoCarga,
  formularioFiltrosVacio,
  interpretarFiltros,
  ORDEN_INICIAL,
  type FormularioFiltros,
  type Orden,
} from "@/lib/etl/filtros"
import { limpiar, type ResultadoLimpieza } from "@/lib/etl/limpieza"
import { medir } from "@/lib/etl/medir"
import type { RegistroMedicion, RegistroTransformado } from "@/lib/etl/tipos"
import { transformarRespuesta } from "@/lib/etl/transformacion"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

export type ExtraccionCiudad = {
  ciudadId: string
  nombre: string
  estado: EstadoFase
  url: string | null
  /** JSON original tal y como lo devolvió Open-Meteo. Se conserva durante la sesión. */
  json: unknown
  error: string | null
  duracionMs: number | null
  filas: number | null
  descargadoEn: string | null
}

export type Sesion = { inicio: string; fin: string; ciudadIds: string[] }

export type Procesado = {
  transformados: RegistroTransformado[]
  incidencias: { ciudad: string; mensajes: string[] }[]
  filasEntrada: number
  duracionTransformacionMs: number
  limpieza: ResultadoLimpieza
  duracionLimpiezaMs: number
}

export type EstadoCarga = {
  congelados: RegistroMedicion[]
  huella: string
  lotes: EstadoLote[]
  estado: EstadoFase
  verificando: boolean
  verificacion: ResultadoVerificacion | null
  duracionMs: number
}

export type EstadoSupabase = {
  configurado: boolean
  tablaDisponible: boolean
  escrituraPermitida: boolean
  filas?: number | null
  mensaje: string | null
}

const NOMBRES = CIUDADES.map((c) => c.nombre)

function contarFilas(json: unknown): number {
  const time = (json as { hourly?: { time?: unknown } })?.hourly?.time
  return Array.isArray(time) ? time.length : 0
}

async function leerRespuesta(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json()
  } catch {
    return { ok: false, error: `Respuesta no válida del servidor (HTTP ${res.status}).` }
  }
}

const enviarLote: EnviarLote = async (registros) => {
  const res = await fetch("/api/supabase/cargar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros }),
  })
  const datos = await leerRespuesta(res)
  if (!res.ok || datos.ok !== true) {
    const invalidos = datos.invalidos as { posicion: number; motivos: string[] }[] | undefined
    const detalle = invalidos?.length
      ? ` Primero: posición ${invalidos[0].posicion}: ${invalidos[0].motivos.join("; ")}.`
      : ""
    return { ok: false, error: `${String(datos.error ?? `HTTP ${res.status}`)}${detalle}` }
  }
  return { ok: true, procesados: Number(datos.procesados) }
}

const consultarClaves: ConsultarClaves = async (claves) => {
  const res = await fetch("/api/supabase/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claves }),
  })
  const datos = await leerRespuesta(res)
  if (!res.ok || datos.ok !== true)
    return { ok: false, error: String(datos.error ?? `HTTP ${res.status}`) }
  return { ok: true, existentes: datos.existentes as string[] }
}

export function usePipelineEtl() {
  const [sesion, setSesion] = React.useState<Sesion | null>(null)
  const [extracciones, setExtracciones] = React.useState<ExtraccionCiudad[]>([])
  const extraccionesRef = React.useRef<ExtraccionCiudad[]>([])
  const [extrayendo, setExtrayendo] = React.useState(false)
  const extrayendoRef = React.useRef(false)

  const [procesado, setProcesado] = React.useState<Procesado | null>(null)
  const [formulario, setFormulario] = React.useState<FormularioFiltros>(() =>
    formularioFiltrosVacio(NOMBRES)
  )
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<ReadonlySet<string>>(() => new Set())

  const [carga, setCarga] = React.useState<EstadoCarga | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const cargandoRef = React.useRef(false)

  const [estadoSupabase, setEstadoSupabase] = React.useState<EstadoSupabase | null>(null)

  const refrescarEstadoSupabase = React.useCallback(async () => {
    try {
      const res = await fetch("/api/supabase/estado", { cache: "no-store" })
      setEstadoSupabase((await res.json()) as EstadoSupabase)
    } catch {
      setEstadoSupabase({
        configurado: false,
        tablaDisponible: false,
        escrituraPermitida: false,
        mensaje: "No se pudo consultar el estado de Supabase.",
      })
    }
  }, [])

  React.useEffect(() => {
    let activo = true
    fetch("/api/supabase/estado", { cache: "no-store" })
      .then((r) => r.json())
      .then((e: EstadoSupabase) => activo && setEstadoSupabase(e))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const actualizarCiudad = (ciudadId: string, cambio: Partial<ExtraccionCiudad>) => {
    extraccionesRef.current = extraccionesRef.current.map((e) =>
      e.ciudadId === ciudadId ? { ...e, ...cambio } : e
    )
    setExtracciones(extraccionesRef.current)
  }

  const descargar = async (ciudadId: string, s: Sesion) => {
    actualizarCiudad(ciudadId, { estado: "en_curso", error: null })
    const inicio = performance.now()
    const params = new URLSearchParams({ ciudad: ciudadId, inicio: s.inicio, fin: s.fin })
    try {
      const res = await fetch(`/api/open-meteo?${params}`, { cache: "no-store" })
      const datos = await leerRespuesta(res)
      const duracionMs = performance.now() - inicio
      if (!res.ok || datos.ok !== true) {
        actualizarCiudad(ciudadId, {
          estado: "error",
          error: String(datos.error ?? `HTTP ${res.status}`),
          url: (datos.url as string) ?? null,
          duracionMs,
        })
        return
      }
      // Un reintento sustituye la respuesta anterior de la ciudad: nunca se acumulan.
      actualizarCiudad(ciudadId, {
        estado: "completada",
        url: datos.url as string,
        json: datos.json,
        filas: contarFilas(datos.json),
        duracionMs,
        descargadoEn: new Date().toISOString(),
      })
    } catch {
      actualizarCiudad(ciudadId, {
        estado: "error",
        error: "No se pudo contactar con el servidor de la aplicación.",
        duracionMs: performance.now() - inicio,
      })
    }
  }

  /** Transformación y limpieza sobre todas las respuestas correctas de la sesión. */
  const procesar = (lista: ExtraccionCiudad[]) => {
    const correctas = lista.filter((e) => e.estado === "completada")
    if (!correctas.length) {
      setProcesado(null)
      setSeleccion(new Set())
      return
    }
    const t = medir(() => {
      const transformados: RegistroTransformado[] = []
      const incidencias: Procesado["incidencias"] = []
      for (const e of correctas) {
        const r = transformarRespuesta(e.ciudadId, buscarCiudad(e.ciudadId)?.nombre ?? null, e.json)
        transformados.push(...r.registros)
        if (r.incidencias.length) incidencias.push({ ciudad: e.nombre, mensajes: r.incidencias })
      }
      return { transformados, incidencias }
    })
    const l = medir(() => limpiar(t.resultado.transformados))
    setProcesado({
      ...t.resultado,
      filasEntrada: correctas.reduce((s, e) => s + (e.filas ?? 0), 0),
      duracionTransformacionMs: t.duracionMs,
      limpieza: l.resultado,
      duracionLimpiezaMs: l.duracionMs,
    })
    // Conserva la selección solo para claves que siguen siendo válidas.
    const claves = new Set(l.resultado.validos.map((v) => v.clave))
    setSeleccion((prev) => new Set([...prev].filter((k) => claves.has(k))))
  }

  const extraer = async (inicio: string, fin: string, ciudadIds: string[]) => {
    if (extrayendoRef.current || cargandoRef.current) return
    extrayendoRef.current = true
    setExtrayendo(true)
    const s = { inicio, fin, ciudadIds }
    setSesion(s)
    extraccionesRef.current = ciudadIds.map((id) => ({
      ciudadId: id,
      nombre: buscarCiudad(id)?.nombre ?? id,
      estado: "pendiente",
      url: null,
      json: undefined,
      error: null,
      duracionMs: null,
      filas: null,
      descargadoEn: null,
    }))
    setExtracciones(extraccionesRef.current)
    setProcesado(null)
    setSeleccion(new Set())
    setCarga(null)
    setFormulario(formularioFiltrosVacio(NOMBRES))
    setOrden(ORDEN_INICIAL)
    // Secuencial: permite ver qué ciudades se han procesado y cuáles quedan.
    for (const id of ciudadIds) await descargar(id, s)
    procesar(extraccionesRef.current)
    extrayendoRef.current = false
    setExtrayendo(false)
  }

  const reintentarCiudad = async (ciudadId: string) => {
    if (!sesion || extrayendoRef.current) return
    extrayendoRef.current = true
    setExtrayendo(true)
    await descargar(ciudadId, sesion)
    procesar(extraccionesRef.current)
    extrayendoRef.current = false
    setExtrayendo(false)
  }

  const validos = React.useMemo(() => procesado?.limpieza.validos ?? [], [procesado])
  const { filtros, errores: erroresFiltros } = React.useMemo(
    () => interpretarFiltros(formulario, NOMBRES),
    [formulario]
  )
  const { resultado: conjunto, duracionMs: duracionFiltradoMs } = React.useMemo(
    () => medir(() => calcularConjuntoCarga(validos, filtros, orden, seleccion)),
    [validos, filtros, orden, seleccion]
  )
  const huellaVistaPrevia = React.useMemo(
    () => huellaConjunto(conjunto.aCargar),
    [conjunto.aCargar]
  )

  const alternarSeleccion = (clave: string, seleccionado: boolean) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (seleccionado) s.add(clave)
      else s.delete(clave)
      return s
    })
  const seleccionarClaves = (claves: string[], seleccionado: boolean) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      for (const c of claves) {
        if (seleccionado) s.add(c)
        else s.delete(c)
      }
      return s
    })
  const seleccionarCoincidentes = () =>
    seleccionarClaves(conjunto.coincidentes.map((r) => r.clave), true)
  const vaciarSeleccion = () => setSeleccion(new Set())
  const restablecerFiltros = () => {
    setFormulario(formularioFiltrosVacio(NOMBRES))
    setOrden(ORDEN_INICIAL)
  }

  const ejecutarCarga = async (
    lotes: EstadoLote[],
    numeros: number[],
    base: Omit<EstadoCarga, "lotes" | "estado" | "verificando" | "verificacion">
  ) => {
    const inicio = performance.now()
    const finales = await ejecutarLotes(lotes, numeros, enviarLote, (l) =>
      setCarga((c) => (c ? { ...c, lotes: l } : c))
    )
    setCarga((c) => (c ? { ...c, lotes: finales, verificando: true } : c))
    const enviados = finales.filter((l) => l.estado === "completado").flatMap((l) => l.registros)
    const verificacion = enviados.length ? await verificarClaves(enviados, consultarClaves) : null
    const hayErrores =
      finales.some((l) => l.estado === "error") ||
      (verificacion !== null &&
        (verificacion.faltantes.length > 0 || verificacion.errores.length > 0))
    setCarga({
      ...base,
      lotes: finales,
      estado: hayErrores ? "error" : "completada",
      verificando: false,
      verificacion,
      duracionMs: base.duracionMs + (performance.now() - inicio),
    })
  }

  const cargar = async () => {
    if (cargandoRef.current || extrayendoRef.current || !conjunto.aCargar.length) return
    cargandoRef.current = true
    setCargando(true)
    try {
      // Copia congelada: cambiar filtros o selección después no altera esta carga.
      const congelados = congelar(conjunto.aCargar)
      const lotes = crearLotes(congelados)
      const base = { congelados, huella: huellaConjunto(congelados), duracionMs: 0 }
      setCarga({ ...base, lotes, estado: "en_curso", verificando: false, verificacion: null })
      await ejecutarCarga(lotes, lotes.map((l) => l.numero), base)
    } finally {
      cargandoRef.current = false
      setCargando(false)
      refrescarEstadoSupabase()
    }
  }

  const reintentarLotesFallidos = async () => {
    if (!carga || cargandoRef.current) return
    const fallidos = carga.lotes.filter((l) => l.estado === "error").map((l) => l.numero)
    if (!fallidos.length) return
    cargandoRef.current = true
    setCargando(true)
    try {
      setCarga({ ...carga, estado: "en_curso", verificacion: null })
      await ejecutarCarga(carga.lotes, fallidos, carga)
    } finally {
      cargandoRef.current = false
      setCargando(false)
      refrescarEstadoSupabase()
    }
  }

  return {
    sesion,
    extracciones,
    extrayendo,
    extraer,
    reintentarCiudad,
    procesado,
    validos,
    formulario,
    setFormulario,
    erroresFiltros,
    orden,
    setOrden,
    seleccion,
    conjunto,
    duracionFiltradoMs,
    huellaVistaPrevia,
    alternarSeleccion,
    seleccionarClaves,
    seleccionarCoincidentes,
    vaciarSeleccion,
    restablecerFiltros,
    carga,
    cargando,
    cargar,
    reintentarLotesFallidos,
    estadoSupabase,
    refrescarEstadoSupabase,
  }
}

export type PipelineEtl = ReturnType<typeof usePipelineEtl>
