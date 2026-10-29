import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { EfectosHud } from "@/components/hud/efectos-hud"
import { FondoHud } from "@/components/hud/fondo-hud"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <FondoHud />
          <EfectosHud />
          <Toaster>{children}</Toaster>
        </ThemeProvider>
      </body>
    </html>
  )
}
