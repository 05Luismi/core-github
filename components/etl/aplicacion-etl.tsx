"use client"

import * as React from "react"
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon } from "lucide-react"

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

function CabeceraVista({ vista }: { vista: Vista }) {
  const i = IDS_VISTAS.indexOf(vista)
  const v = VISTAS[i]
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black text-primary shadow-md shadow-primary/25">
        <v.icono aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium tracking-wide text-primary-strong uppercase">
          Paso {i + 1} de {VISTAS.length}
        </p>
        <h1 className="text-xl font-semibold">{v.texto}</h1>
        <p className="text-sm text-muted-foreground">{v.descripcion}</p>
      </div>
    </div>
  )
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
        <main>
          <MapaCiudades
            etl={etl}
            onIrAExtraccion={() => cambiarVista("extraccion")}
          />
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
          <AvisoSupabase etl={etl} />
          <CabeceraVista vista={vista} />

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
                          className="entrada elevable sombra-suave group flex items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-primary/15 hover:ring-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black text-primary shadow-md shadow-primary/25 transition-transform duration-200 group-hover:scale-110">
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
