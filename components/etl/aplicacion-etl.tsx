"use client"

import * as React from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { ConfiguracionExtraccion } from "@/components/etl/configuracion-extraccion"
import { Contadores } from "@/components/etl/contadores"
import { MapaCiudades } from "@/components/etl/mapa-ciudades"
import { PestanaCarga } from "@/components/etl/pestana-carga"
import { PestanaJson } from "@/components/etl/pestana-json"
import { PestanaRechazados } from "@/components/etl/pestana-rechazados"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { PestanaTransformados } from "@/components/etl/pestana-transformados"
import { PestanaValidos } from "@/components/etl/pestana-validos"
import { VisualizacionPipeline, type Pestana } from "@/components/etl/pipeline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatearEntero } from "@/lib/etl/formato"

export function AplicacionEtl() {
  const etl = usePipelineEtl()
  const [pestana, setPestana] = React.useState<Pestana>("json")
  const zonaDatos = React.useRef<HTMLElement>(null)
  const p = etl.procesado
  const s = etl.estadoSupabase

  const inspeccionar = (destino: Pestana) => {
    setPestana(destino)
    zonaDatos.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const pestanas: { valor: Pestana; texto: string; n?: number }[] = [
    { valor: "json", texto: "JSON original", n: etl.extracciones.filter((e) => e.json !== undefined).length || undefined },
    { valor: "transformados", texto: "Transformados", n: p?.transformados.length },
    { valor: "validos", texto: "Registros válidos", n: p?.limpieza.validos.length },
    { valor: "rechazados", texto: "Rechazados", n: p?.limpieza.rechazados.length },
    { valor: "carga", texto: "Vista previa de la carga", n: p ? etl.conjunto.aCargar.length : undefined },
    { valor: "supabase", texto: "Datos en Supabase" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Big Data · Práctica 1
        </p>
        <h1 className="text-2xl font-semibold">Pipeline ETL: Open-Meteo → Supabase</h1>
        <p className="max-w-3xl text-muted-foreground">
          Extrae mediciones horarias reales, observa cómo cambian en cada fase y decide exactamente qué
          registros se cargan en la base de datos.
        </p>
        <p className="flex items-center gap-1.5 text-xs" role="status">
          {!s ? (
            <span className="text-muted-foreground">Comprobando Supabase…</span>
          ) : s.configurado && s.tablaDisponible ? (
            <>
              <CircleCheckIcon aria-hidden className="size-3.5 text-emerald-600" />
              Supabase conectado · tabla mediciones_meteorologicas disponible
              {typeof s.filas === "number" && ` · ${formatearEntero(s.filas)} filas persistidas`}
            </>
          ) : (
            <>
              <CircleAlertIcon aria-hidden className="size-3.5 text-destructive" />
              <span className="text-destructive">Supabase no disponible: {s.mensaje}</span>
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <ConfiguracionExtraccion etl={etl} />
        </aside>
        <main className="flex min-w-0 flex-col gap-6">
          <VisualizacionPipeline etl={etl} onInspeccionar={inspeccionar} />
          <Contadores etl={etl} />
          <MapaCiudades etl={etl} />

          <section ref={zonaDatos} aria-labelledby="titulo-inspeccion" className="flex scroll-mt-4 flex-col gap-3">
            <h2 id="titulo-inspeccion" className="text-base font-medium">
              3. Inspección de datos
            </h2>
            <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
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
              <TabsContent value="json"><PestanaJson etl={etl} /></TabsContent>
              <TabsContent value="transformados"><PestanaTransformados etl={etl} /></TabsContent>
              <TabsContent value="validos"><PestanaValidos etl={etl} /></TabsContent>
              <TabsContent value="rechazados"><PestanaRechazados etl={etl} /></TabsContent>
              <TabsContent value="carga"><PestanaCarga etl={etl} /></TabsContent>
              <TabsContent value="supabase"><PestanaSupabase etl={etl} /></TabsContent>
            </Tabs>
          </section>
        </main>
      </div>
    </div>
  )
}
