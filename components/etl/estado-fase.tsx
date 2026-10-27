import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react"
import { cn } from "cn"

import type { EstadoFase } from "@/hooks/use-pipeline-etl"

const ESTADOS: Record<
  EstadoFase,
  { texto: string; icono: typeof CircleCheckIcon; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    clase: "border-border text-muted-foreground",
  },
  en_curso: {
    texto: "En curso",
    icono: LoaderCircleIcon,
    clase: "border-sky-600/40 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  },
  completada: {
    texto: "Completada",
    icono: CircleCheckIcon,
    clase: "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  error: {
    texto: "Con errores",
    icono: CircleAlertIcon,
    clase: "border-destructive/40 bg-destructive/10 text-destructive",
  },
}

/** Estado con icono y texto: no depende solo del color. */
export function EstadoFaseBadge({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const e = ESTADOS[estado]
  const Icono = e.icono
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        e.clase,
        className
      )}
    >
      <Icono
        aria-hidden
        className={cn("size-3.5", estado === "en_curso" && "animate-spin")}
      />
      {texto ?? e.texto}
    </span>
  )
}
