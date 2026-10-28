"use client"

import * as React from "react"

/** Interpola hacia `objetivo` con una curva suave; salta directamente si el usuario pidió reducir movimiento. */
export function useNumeroAnimado(objetivo: number, duracionMs = 550): number {
  const [valor, setValor] = React.useState(objetivo)
  const actual = React.useRef(objetivo)

  React.useEffect(() => {
    const desde = actual.current
    if (desde === objetivo) return
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const k = reducido ? 1 : Math.min(1, (t - t0) / duracionMs)
      const v = Math.round(desde + (objetivo - desde) * (1 - (1 - k) ** 3))
      actual.current = v
      setValor(v)
      if (k < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [objetivo, duracionMs])

  return valor
}
