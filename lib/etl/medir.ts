/** Ejecuta una operación síncrona y devuelve su resultado junto con la duración real. */
export function medir<T>(fn: () => T): { resultado: T; duracionMs: number } {
  const inicio = performance.now()
  const resultado = fn()
  return { resultado, duracionMs: performance.now() - inicio }
}
