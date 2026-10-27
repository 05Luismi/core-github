import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA_MEDICIONES = "mediciones_meteorologicas"

export type ConfiguracionSupabase =
  | { ok: true; cliente: SupabaseClient }
  | { ok: false; faltan: string[] }

let cliente: SupabaseClient | null = null

/**
 * Cliente con la secret key (rol service_role). Solo se crea en servidor:
 * "server-only" rompe la build si se importa desde un componente de cliente.
 */
export function obtenerSupabase(): ConfiguracionSupabase {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY
  const faltan: string[] = []
  if (!url) faltan.push("SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)")
  if (!clave) faltan.push("SUPABASE_SECRET_KEY")
  if (!url || !clave) return { ok: false, faltan }
  cliente ??= createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { ok: true, cliente }
}

/**
 * El proyecto no tiene autenticación. La escritura queda abierta en desarrollo
 * y bloqueada en producción salvo que se habilite explícitamente después de
 * añadir protección (autenticación, red privada...).
 */
export function escrituraPermitida(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  return process.env.ETL_PERMITIR_ESCRITURA === "true"
}

/** Mensaje de error sin datos sensibles para devolver al navegador. */
export function mensajeError(error: { message?: string; code?: string } | null) {
  if (!error) return "Error desconocido"
  if (error.code === "42P01" || error.code === "PGRST205")
    return `La tabla «${TABLA_MEDICIONES}» no existe. Aplica la migración de supabase/migrations.`
  return error.code ? `${error.message} (código ${error.code})` : (error.message ?? "Error")
}
