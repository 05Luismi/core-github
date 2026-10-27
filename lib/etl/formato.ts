const numeroEs = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })
const enteroEs = new Intl.NumberFormat("es-ES")

export function formatearNumero(n: number): string {
  return numeroEs.format(n)
}

export function formatearEntero(n: number): string {
  return enteroEs.format(n)
}

/** "2026-09-01T00:00:00Z" → "2026-09-01 00:00 UTC". Siempre en UTC, nunca en hora local. */
export function formatearFechaUtc(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  const t = new Date(ms).toISOString()
  return `${t.slice(0, 10)} ${t.slice(11, 16)} UTC`
}

export function formatearDuracion(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${numeroEs.format(ms / 1000)} s`
}
