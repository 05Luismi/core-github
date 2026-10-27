"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatearEntero } from "@/lib/etl/formato"
import { paginar } from "@/lib/etl/filtros"

export type Columna<T> = {
  id: string
  encabezado: React.ReactNode | ((filasPagina: T[]) => React.ReactNode)
  celda: (fila: T, posicion: number) => React.ReactNode
  numerica?: boolean
  className?: string
}

export const TAMANOS_PAGINA = [25, 50, 100]

/**
 * Tabla con paginación local. Recibe las filas ya filtradas y ordenadas:
 * la paginación solo recorta lo que se muestra.
 */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  reinicio,
  vacio = "No hay registros.",
  etiqueta,
  claseFila,
}: {
  filas: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  /** Cuando cambia (p. ej. filtros u orden), se vuelve a la primera página. */
  reinicio?: string
  vacio?: React.ReactNode
  etiqueta: string
  claseFila?: (fila: T) => string | undefined
}) {
  const [pagina, setPagina] = React.useState(1)
  const [tamano, setTamano] = React.useState(25)
  const [reinicioPrevio, setReinicioPrevio] = React.useState(reinicio)
  if (reinicio !== reinicioPrevio) {
    setReinicioPrevio(reinicio)
    setPagina(1)
  }
  const p = paginar(filas, pagina, tamano)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columnas.map((c) => (
                <TableHead
                  key={c.id}
                  className={cn(c.numerica && "text-right", c.className)}
                >
                  {typeof c.encabezado === "function" ? c.encabezado(p.filas) : c.encabezado}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.filas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnas.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              p.filas.map((f, i) => (
                <TableRow key={claveFila(f)} className={claseFila?.(f)}>
                  {columnas.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(c.numerica && "text-right tabular-nums", c.className)}
                    >
                      {c.celda(f, p.desde + i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label={`Paginación: ${etiqueta}`}
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
      >
        <span aria-live="polite">
          {filas.length
            ? `Filas ${formatearEntero(p.desde)}–${formatearEntero(p.hasta)} de ${formatearEntero(filas.length)}`
            : "0 filas"}
        </span>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1">
            Filas por página
            <select
              className="h-7 rounded-md border bg-background px-1 text-xs text-foreground"
              value={tamano}
              onChange={(e) => {
                setTamano(Number(e.target.value))
                setPagina(1)
              }}
            >
              {TAMANOS_PAGINA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="icon-sm" aria-label="Primera página" disabled={p.pagina <= 1} onClick={() => setPagina(1)}>
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={p.pagina <= 1} onClick={() => setPagina(p.pagina - 1)}>
            <ChevronLeftIcon />
          </Button>
          <span className="px-2 tabular-nums">
            Página {p.pagina} de {p.totalPaginas}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Página siguiente" disabled={p.pagina >= p.totalPaginas} onClick={() => setPagina(p.pagina + 1)}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Última página" disabled={p.pagina >= p.totalPaginas} onClick={() => setPagina(p.totalPaginas)}>
            <ChevronsRightIcon />
          </Button>
        </div>
      </nav>
    </div>
  )
}

/** Muestra un valor bruto sin convertirlo: null, vacío o ausente se distinguen de 0. */
export function ValorBruto({ valor }: { valor: unknown }) {
  if (valor === undefined)
    return <span className="text-destructive italic">ausente</span>
  if (valor === null) return <code className="text-destructive">null</code>
  if (valor === "") return <code className="text-destructive">&quot;&quot;</code>
  if (typeof valor === "number") return <>{String(valor)}</>
  return <code className="text-destructive">{JSON.stringify(valor)}</code>
}
