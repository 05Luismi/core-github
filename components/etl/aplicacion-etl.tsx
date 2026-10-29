"use client"

import * as React from "react"
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Bienvenida } from "@/components/etl/bienvenida"
import { ConfiguracionExtraccion } from "@/components/etl/configuracion-extraccion"
import { Contadores } from "@/components/etl/contadores"
import { GraficosExtraccion } from "@/components/etl/graficos-extraccion"
import { MapaCiudades } from "@/components/etl/mapa-ciudades"
import {
  MenuSuperior,
  VISTAS,
  type Vista,
} from "@/components/etl/menu-superior"
import { PestanaCarga } from "@/components/etl/pestana-carga"
import { PestanaJson } from "@/components/etl/pestana-json"
import { PestanaRechazados } from "@/components/etl/pestana-rechazados"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { PestanaTransformados } from "@/components/etl/pestana-transformados"
import { PestanaValidos } from "@/components/etl/pestana-validos"
import { VisualizacionPipeline, type Pestana } from "@/components/etl/pipeline"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePipelineEtl, type PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero } from "@/lib/etl/formato"

const IDS_VISTAS = VISTAS.map((v) => v.id)

/** Vista actual guardada en el hash de la URL (#mapa…): funciona con atrás/adelante y enlaces directos. */
function useVista(): [Vista, (v: Vista) => void] {
  const hash = React.useSyncExternalStore(
    (avisar) => {
      window.addEventListener("hashchange", avisar)
      return () => window.removeEventListener("hashchange", avisar)
    },
    () => window.location.hash.slice(1),
    () => ""
  )
  const vista = (IDS_VISTAS as string[]).includes(hash)
    ? (hash as Vista)
    : "extraccion"
  const cambiar = React.useCallback((v: Vista) => {
    if (window.location.hash !== `#${v}`) window.location.hash = v
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])
  return [vista, cambiar]
}

type PestanaDatos = Extract<
  Pestana,
  "json" | "transformados" | "validos" | "rechazados"
>
type PestanaCargaVista = Extract<Pestana, "carga" | "supabase">

function ListaPestanas<T extends string>({
  pestanas,
}: {
  pestanas: { valor: T; texto: string; n?: number }[]
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <TabsList>
        {pestanas.map((t) => (
          <TabsTrigger key={t.valor} value={t.valor} className="px-2.5">
            {t.texto}
            {t.n !== undefined && (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {formatearEntero(t.n)}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}

function CabeceraVista({
  vista,
  onCambiar,
}: {
  vista: Vista
  onCambiar: (v: Vista) => void
}) {
  const i = IDS_VISTAS.indexOf(vista)
  const v = VISTAS[i]
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="hud-marco pulso-hud flex size-11 shrink-0 items-center justify-center rounded-xl bg-panel text-primary shadow-md shadow-primary/25">
          <v.icono aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="hud-etiqueta text-primary-strong">
            Paso {String(i + 1).padStart(2, "0")} / {String(VISTAS.length).padStart(2, "0")}
          </p>
          <h1 className="brillo-texto text-xl font-semibold tracking-wide">{v.texto}</h1>
          <p className="text-sm text-muted-foreground">{v.descripcion}</p>
        </div>
      </div>
      {/* Barra de pasos: cada segmento lleva a su apartado. */}
      <ol aria-label="Progreso por los apartados" className="flex w-full gap-1.5 sm:w-auto">
        {VISTAS.map((p, n) => (
          <li key={p.id} className="flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => onCambiar(p.id)}
              aria-current={n === i ? "step" : undefined}
              title={`${n + 1}. ${p.texto}`}
              className="group flex w-full flex-col gap-1 rounded-md py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-14"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-all duration-300 group-hover:bg-primary/70",
                  n < i ? "bg-primary/60" : n === i ? "bg-primary shadow-[0_0_10px] shadow-primary" : "bg-primary/15"
                )}
              />
              <span className={cn("hud-etiqueta text-left", n === i ? "text-primary-strong" : "text-muted-foreground")}>
                {String(n + 1).padStart(2, "0")}
                <span className="sr-only"> {p.texto}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function esZonaDeEscritura(objetivo: EventTarget | null) {
  return (
    objetivo instanceof HTMLElement &&
    (objetivo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName))
  )
}

/** Atajos: 1–5 saltan a un apartado; ← y → avanzan o retroceden cuando no hay nada enfocado. */
function useAtajosVistas(vista: Vista, cambiar: (v: Vista) => void) {
  React.useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (esZonaDeEscritura(e.target)) return
      const i = IDS_VISTAS.indexOf(vista)
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= VISTAS.length) {
        cambiar(VISTAS[n - 1].id)
        return
      }
      const libre = !document.activeElement || document.activeElement === document.body
      if (!libre) return
      if (e.key === "ArrowRight" && VISTAS[i + 1]) cambiar(VISTAS[i + 1].id)
      if (e.key === "ArrowLeft" && VISTAS[i - 1]) cambiar(VISTAS[i - 1].id)
    }
    window.addEventListener("keydown", alPulsar)
    return () => window.removeEventListener("keydown", alPulsar)
  }, [vista, cambiar])
}

const UMBRAL_GESTO = 70

/** Deslizar horizontalmente con el dedo cambia de apartado (fuera de tablas, gráficas y campos). */
function useGestoDeslizar(vista: Vista, cambiar: (v: Vista) => void) {
  const inicio = React.useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.target instanceof Element ? e.target : null
      const bloqueado = t?.closest("input, textarea, select, table, svg, [data-sin-gesto], .overflow-x-auto")
      inicio.current = bloqueado || e.touches.length !== 1 ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const a = inicio.current
      inicio.current = null
      if (!a) return
      const dx = e.changedTouches[0].clientX - a.x
      const dy = e.changedTouches[0].clientY - a.y
      if (Math.abs(dx) < UMBRAL_GESTO || Math.abs(dy) > Math.abs(dx) * 0.6) return
      const i = IDS_VISTAS.indexOf(vista)
      const destino = VISTAS[dx < 0 ? i + 1 : i - 1]
      if (destino) cambiar(destino.id)
    },
  }
}

/** Botones anterior/siguiente al final de cada apartado. */
function NavegacionPasos({
  vista,
  onCambiar,
}: {
  vista: Vista
  onCambiar: (v: Vista) => void
}) {
  const i = IDS_VISTAS.indexOf(vista)
  const anterior = VISTAS[i - 1]
  const siguiente = VISTAS[i + 1]
  return (
    <nav
      aria-label="Pasos"
      className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"
    >
      {anterior ? (
        <Button variant="outline" onClick={() => onCambiar(anterior.id)}>
          <ArrowLeftIcon data-icon="inline-start" />
          {anterior.texto}
        </Button>
      ) : (
        <span />
      )}
      {siguiente && (
        <Button onClick={() => onCambiar(siguiente.id)}>
          Siguiente: {siguiente.texto}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      )}
    </nav>
  )
}

function AvisoSupabase({ etl }: { etl: PipelineEtl }) {
  const s = etl.estadoSupabase
  if (!s || (s.configurado && s.tablaDisponible)) return null
  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
      Supabase no disponible: {s.mensaje}
    </p>
  )
}

export function AplicacionEtl() {
  const etl = usePipelineEtl()
  const [vista, cambiarVista] = useVista()
  const [pestanaDatos, setPestanaDatos] = React.useState<PestanaDatos>("json")
  const [pestanaCarga, setPestanaCarga] =
    React.useState<PestanaCargaVista>("carga")
  const zonaConfiguracion = React.useRef<HTMLDivElement>(null)
  const p = etl.procesado
  useAtajosVistas(vista, cambiarVista)
  const gesto = useGestoDeslizar(vista, cambiarVista)

  // La transición entra por la derecha al avanzar y por la izquierda al retroceder.
  const [vistaPrevia, setVistaPrevia] = React.useState(vista)
  const [transicion, setTransicion] = React.useState("vista-derecha")
  if (vistaPrevia !== vista) {
    setVistaPrevia(vista)
    setTransicion(IDS_VISTAS.indexOf(vista) >= IDS_VISTAS.indexOf(vistaPrevia) ? "vista-derecha" : "vista-izquierda")
  }

  const inspeccionar = (destino: Pestana) => {
    if (destino === "carga" || destino === "supabase") {
      setPestanaCarga(destino)
      cambiarVista("carga")
    } else {
      setPestanaDatos(destino)
      cambiarVista("datos")
    }
  }

  const irAConfiguracion = () => {
    zonaConfiguracion.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
    zonaConfiguracion.current
      ?.querySelector<HTMLElement>("button, input")
      ?.focus({ preventScroll: true })
  }

  return (
    <>
      <MenuSuperior etl={etl} vista={vista} onCambiar={cambiarVista} />
      {vista === "mapa" ? (
        <main className={transicion}>
          <MapaCiudades
            etl={etl}
            onIrAExtraccion={() => cambiarVista("extraccion")}
          />
        </main>
      ) : (
        <main
          key={vista}
          {...gesto}
          className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6", transicion)}
        >
          <AvisoSupabase etl={etl} />
          <CabeceraVista vista={vista} onCambiar={cambiarVista} />

          {vista === "extraccion" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
              <div ref={zonaConfiguracion} className="scroll-mt-20">
                <ConfiguracionExtraccion etl={etl} />
              </div>
              <div className="flex min-w-0 flex-col gap-6">
                {etl.extracciones.length === 0 ? (
                  <Bienvenida etl={etl} onConfigurar={irAConfiguracion} />
                ) : (
                  <>
                    <Contadores etl={etl} />
                    <GraficosExtraccion etl={etl} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {VISTAS.slice(1).map((v, i) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => cambiarVista(v.id)}
                          style={{ "--retraso": `${i * 60}ms` } as React.CSSProperties}
                          className="entrada elevable sombra-suave hud-marco foco cristal group flex items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-primary/15 hover:ring-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel text-primary shadow-md shadow-primary/25 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
                            <v.icono aria-hidden className="size-4.5" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-1 font-medium">
                              {v.texto}
                              <ArrowRightIcon
                                aria-hidden
                                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                              />
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {v.descripcion}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {vista === "pipeline" && (
            <>
              <VisualizacionPipeline etl={etl} onInspeccionar={inspeccionar} />
              <Contadores etl={etl} />
            </>
          )}

          {vista === "datos" && (
            <Tabs
              value={pestanaDatos}
              onValueChange={(v) => setPestanaDatos(v as PestanaDatos)}
            >
              <ListaPestanas<PestanaDatos>
                pestanas={[
                  {
                    valor: "json",
                    texto: "JSON original",
                    n:
                      etl.extracciones.filter((e) => e.json !== undefined)
                        .length || undefined,
                  },
                  {
                    valor: "transformados",
                    texto: "Transformados",
                    n: p?.transformados.length,
                  },
                  {
                    valor: "validos",
                    texto: "Válidos",
                    n: p?.limpieza.validos.length,
                  },
                  {
                    valor: "rechazados",
                    texto: "Rechazados",
                    n: p?.limpieza.rechazados.length,
                  },
                ]}
              />
              <TabsContent value="json">
                <PestanaJson etl={etl} />
              </TabsContent>
              <TabsContent value="transformados">
                <PestanaTransformados etl={etl} />
              </TabsContent>
              <TabsContent value="validos">
                <PestanaValidos etl={etl} />
              </TabsContent>
              <TabsContent value="rechazados">
                <PestanaRechazados etl={etl} />
              </TabsContent>
            </Tabs>
          )}

          {vista === "carga" && (
            <Tabs
              value={pestanaCarga}
              onValueChange={(v) => setPestanaCarga(v as PestanaCargaVista)}
            >
              <ListaPestanas<PestanaCargaVista>
                pestanas={[
                  {
                    valor: "carga",
                    texto: "Vista previa y carga",
                    n: p ? etl.conjunto.aCargar.length : undefined,
                  },
                  { valor: "supabase", texto: "Datos en Supabase" },
                ]}
              />
              <TabsContent value="carga">
                <PestanaCarga etl={etl} />
              </TabsContent>
              <TabsContent value="supabase">
                <PestanaSupabase etl={etl} />
              </TabsContent>
            </Tabs>
          )}

          <NavegacionPasos vista={vista} onCambiar={cambiarVista} />
        </main>
      )}
    </>
  )
}
