"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"

function Progress({
  className,
  etiqueta,
  ...props
}: ProgressPrimitive.Root.Props & { etiqueta?: React.ReactNode }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5", className)}
      {...props}
    >
      {etiqueta && <ProgressPrimitive.Label className="truncate text-xs font-medium">{etiqueta}</ProgressPrimitive.Label>}
      {etiqueta && <ProgressPrimitive.Value className="text-xs text-muted-foreground tabular-nums" />}
      <ProgressPrimitive.Track className="col-span-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
        <ProgressPrimitive.Indicator className="rounded-full bg-primary transition-[width] duration-500 ease-out" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
