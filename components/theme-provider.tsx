"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/** La interfaz HUD solo tiene modo oscuro: el tema queda fijado y no se puede cambiar. */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="dark"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
