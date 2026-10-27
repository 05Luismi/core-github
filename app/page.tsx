import type { Metadata } from "next"

import { AplicacionEtl } from "@/components/etl/aplicacion-etl"

export const metadata: Metadata = {
  title: "Pipeline ETL · Open-Meteo → Supabase",
  description: "Práctica de Big Data: extracción, transformación, limpieza, filtrado y carga.",
}

export default function Page() {
  return <AplicacionEtl />
}
