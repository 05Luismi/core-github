"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/** Alterna claro/oscuro. Los iconos se muestran con CSS para no depender del tema en el primer render. */
export function BotonTema({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon"
      className={className}
      aria-label="Cambiar entre tema claro y oscuro (atajo: D)"
      title="Cambiar tema (D)"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
