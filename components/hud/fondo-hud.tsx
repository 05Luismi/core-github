"use client"

import * as React from "react"

const ANCHO = 1600
const ALTO = 900

/** Generador pseudoaleatorio con semilla: el servidor y el navegador dibujan la misma red. */
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

type Nodo = { x: number; y: number }

// Núcleos alrededor de los que se agrupan los nodos, como continentes en un mapa de red.
const NUCLEOS = [
  { x: 330, y: 260, r: 170, n: 9 },
  { x: 470, y: 600, r: 120, n: 6 },
  { x: 800, y: 230, r: 120, n: 7 },
  { x: 850, y: 520, r: 130, n: 7 },
  { x: 1150, y: 290, r: 190, n: 10 },
  { x: 1330, y: 640, r: 100, n: 5 },
]

function crearRed() {
  const azar = aleatorio(20261029)
  const nodos: Nodo[] = []
  for (const c of NUCLEOS) {
    for (let i = 0; i < c.n; i++) {
      const angulo = azar() * Math.PI * 2
      const radio = Math.sqrt(azar()) * c.r
      nodos.push({ x: Math.round(c.x + Math.cos(angulo) * radio), y: Math.round(c.y + Math.sin(angulo) * radio * 0.7) })
    }
  }
  // Cada nodo se une a sus dos vecinos más cercanos; algunos enlaces largos cruzan entre núcleos.
  const enlaces = new Set<string>()
  nodos.forEach((a, i) => {
    nodos
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter((v) => v.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => enlaces.add(i < j ? `${i}-${j}` : `${j}-${i}`))
  })
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(azar() * nodos.length)
    const j = Math.floor(azar() * nodos.length)
    if (i !== j) enlaces.add(i < j ? `${i}-${j}` : `${j}-${i}`)
  }
  const lineas = [...enlaces].map((e) => e.split("-").map(Number) as [number, number])
  return { nodos, lineas }
}

const RED = crearRed()

function usePrefiereMovimiento() {
  return React.useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

/** Fondo decorativo fijo: rejilla, red de nodos con paquetes de datos y una línea de barrido. */
export function FondoHud() {
  const movimiento = usePrefiereMovimiento()
  const { nodos, lineas } = RED
  // Los paquetes recorren unos pocos enlaces largos; solo si el usuario no pidió reducir movimiento.
  const rutas = lineas.filter((_, i) => i % 5 === 0).slice(0, 12)

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--hud-rejilla) 1px, transparent 1px), linear-gradient(90deg, var(--hud-rejilla) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_60%)]" />
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] transition-transform duration-700 ease-out"
        style={{ transform: "translate(calc(var(--px, 0) * -14px), calc(var(--py, 0) * -10px))" }}
      >
        <g stroke="var(--hud-linea)" strokeWidth="0.8">
          {lineas.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={nodos[a].x} y1={nodos[a].y} x2={nodos[b].x} y2={nodos[b].y} />
          ))}
        </g>
        <g fill="var(--hud-nodo)">
          {nodos.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r="2"
              className="latido"
              style={{ "--retraso": `${(i * 397) % 3200}ms` } as React.CSSProperties}
            />
          ))}
        </g>
        {movimiento && (
          <g fill="var(--hud-nodo)">
            {rutas.map(([a, b], i) => (
              <circle key={`${a}-${b}`} r="2.4" opacity="0.9">
                <animateMotion
                  dur={`${3 + (i % 4)}s`}
                  begin={`${i * 0.7}s`}
                  repeatCount="indefinite"
                  path={`M${nodos[a].x},${nodos[a].y} L${nodos[b].x},${nodos[b].y}`}
                />
              </circle>
            ))}
          </g>
        )}
      </svg>
      <div className="barrido absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-primary/[0.06] to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,color-mix(in_oklch,var(--background)_85%,transparent))]" />
    </div>
  )
}
