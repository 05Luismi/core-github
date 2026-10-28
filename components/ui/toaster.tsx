"use client"

import { Toast } from "@base-ui/react/toast"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, XIcon } from "lucide-react"
import { cn } from "cn"

/** Gestor global: permite lanzar avisos desde fuera del árbol de React (p. ej. desde hooks). */
export const avisos = Toast.createToastManager()

const ICONOS = {
  success: { icono: CircleCheckIcon, clase: "text-emerald-600 dark:text-emerald-400" },
  error: { icono: CircleAlertIcon, clase: "text-destructive" },
  info: { icono: InfoIcon, clase: "text-primary-strong" },
} as const

function ListaAvisos() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((t) => {
    const { icono: Icono, clase } = ICONOS[(t.type as keyof typeof ICONOS) ?? "info"] ?? ICONOS.info
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          "transition-[opacity,translate] duration-300 ease-out data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
        )}
      >
        <Icono aria-hidden className={cn("mt-0.5 size-4 shrink-0", clase)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Toast.Title className="text-sm font-medium" />
          <Toast.Description className="text-xs text-muted-foreground" />
        </div>
        <Toast.Close
          aria-label="Cerrar aviso"
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <XIcon className="size-3.5" />
        </Toast.Close>
      </Toast.Root>
    )
  })
}

export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={avisos} timeout={6000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] flex-col-reverse gap-2 sm:w-[22rem]">
          <ListaAvisos />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
