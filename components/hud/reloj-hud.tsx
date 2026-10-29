"use client"

import * as React from "react"

function suscribir(avisar: () => void) {
  const id = window.setInterval(avisar, 1000)
  return () => window.clearInterval(id)
}

/** Segundos actuales; null en el servidor para no desajustar la hidratación. */
function useSegundo() {
  return React.useSyncExternalStore(
    suscribir,
    () => Math.floor(Date.now() / 1000),
    () => null
  )
}

const dos = (n: number) => String(n).padStart(2, "0")

/** Reloj UTC y lectura binaria decorativa para la franja técnica del menú. */
export function RelojHud() {
  const s = useSegundo()
  if (s === null) return <span className="hud-etiqueta tabular-nums">UTC --:--:--</span>
  const fecha = new Date(s * 1000)
  const binario = (s % 256).toString(2).padStart(8, "0")
  return (
    <>
      <span className="hud-etiqueta tabular-nums">
        UTC {dos(fecha.getUTCHours())}:{dos(fecha.getUTCMinutes())}:{dos(fecha.getUTCSeconds())}
      </span>
      <span aria-hidden className="hud-etiqueta hidden tabular-nums text-primary/80 md:inline">
        {binario}
      </span>
    </>
  )
}
