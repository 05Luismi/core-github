-- Destino del pipeline ETL Open-Meteo → Supabase.
-- Una fila por ciudad y hora (UTC). La clave natural (ciudad, fecha_hora)
-- permite upserts idempotentes: repetir una carga no duplica filas.
-- Se puede ejecutar varias veces sin error.

create table if not exists public.mediciones_meteorologicas (
  id bigint generated always as identity primary key,
  ciudad text not null,
  fecha_hora timestamptz not null,
  temperatura_c double precision not null,
  humedad_pct double precision not null,
  precipitacion_mm double precision not null,
  importado_en timestamptz not null default now(),

  constraint mediciones_meteorologicas_ciudad_fecha_hora_key
    unique (ciudad, fecha_hora),
  constraint mediciones_meteorologicas_ciudad_no_vacia
    check (length(btrim(ciudad)) > 0),
  -- En Postgres 'NaN' es mayor que cualquier número, así que este rango ya lo excluye.
  constraint mediciones_meteorologicas_humedad_rango
    check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_meteorologicas_precipitacion_valida
    check (
      precipitacion_mm >= 0
      and precipitacion_mm < 'Infinity'::double precision
    ),
  -- Sin rango para temperatura (los extremos son datos), pero sí debe ser finita.
  constraint mediciones_meteorologicas_temperatura_finita
    check (
      temperatura_c > '-Infinity'::double precision
      and temperatura_c < 'Infinity'::double precision
    )
);

-- RLS activado y sin políticas: con la publishable key (roles anon y
-- authenticated) no se puede leer ni escribir. Solo el servidor, con la
-- secret key (rol service_role, que omite RLS), accede a la tabla.
alter table public.mediciones_meteorologicas enable row level security;

grant select, insert, update on table public.mediciones_meteorologicas to service_role;

-- Que la API (PostgREST) vea la tabla nueva inmediatamente.
notify pgrst, 'reload schema';
