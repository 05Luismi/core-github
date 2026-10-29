"use client"

import * as React from "react"

const INTERACTIVOS = "button, a[href], [role=tab], [role=radio], [role=checkbox], summary, label"
const INCLINACION_MAX = 7

/**
 * Efectos globales de la interfaz HUD, sin estado de React:
 * - pulso en forma de anillo donde se pulsa un control,
 * - foco luminoso que sigue al puntero dentro de los elementos `.foco`,
 * - inclinación 3D de los elementos `.inclinable` según la posición del puntero,
 * - paralaje suave del fondo (--px y --py en <html>).
 */
export function EfectosHud() {
  React.useEffect(() => {
    const raiz = document.documentElement
    const movimiento = window.matchMedia("(prefers-reduced-motion: no-preference)")
    let marco = 0
    let ultimo: PointerEvent | null = null
    let inclinada: HTMLElement | null = null

    const alPulsar = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(INTERACTIVOS)) return
      const onda = document.createElement("span")
      onda.className = "onda-clic"
      onda.style.left = `${e.clientX}px`
      onda.style.top = `${e.clientY}px`
      document.body.appendChild(onda)
      onda.addEventListener("animationend", () => onda.remove(), { once: true })
      // Por si la animación no llega a ejecutarse (movimiento reducido).
      window.setTimeout(() => onda.remove(), 800)
    }

    const aplicar = () => {
      marco = 0
      const e = ultimo
      if (!e) return
      raiz.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
      raiz.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      const objetivo = e.target instanceof Element ? e.target : null
      const foco = objetivo?.closest<HTMLElement>(".foco")
      if (foco) {
        const r = foco.getBoundingClientRect()
        foco.style.setProperty("--mx", `${e.clientX - r.left}px`)
        foco.style.setProperty("--my", `${e.clientY - r.top}px`)
      }
      const tarjeta = objetivo?.closest<HTMLElement>(".inclinable") ?? null
      if (inclinada && inclinada !== tarjeta) {
        inclinada.style.removeProperty("--rx")
        inclinada.style.removeProperty("--ry")
      }
      inclinada = tarjeta
      if (tarjeta && movimiento.matches) {
        const r = tarjeta.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        tarjeta.style.setProperty("--rx", `${(-y * INCLINACION_MAX).toFixed(2)}deg`)
        tarjeta.style.setProperty("--ry", `${(x * INCLINACION_MAX).toFixed(2)}deg`)
      }
    }

    const alMover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      ultimo = e
      if (!marco) marco = requestAnimationFrame(aplicar)
    }

    window.addEventListener("pointerdown", alPulsar, { passive: true })
    window.addEventListener("pointermove", alMover, { passive: true })
    return () => {
      window.removeEventListener("pointerdown", alPulsar)
      window.removeEventListener("pointermove", alMover)
      cancelAnimationFrame(marco)
    }
  }, [])

  return null
}
