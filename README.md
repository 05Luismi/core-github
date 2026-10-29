# Pipeline ETL: Open-Meteo → Supabase

Práctica 1 de Big Data. Aplicación Next.js para ejecutar y **ver** un primer pipeline ETL:
extraer mediciones horarias del archivo histórico de Open-Meteo, transformarlas, limpiarlas,
filtrarlas, seleccionar qué filas subir y cargarlas en Supabase.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui (Base UI) · supabase-js · Vitest.

## Instalación y ejecución

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:3000
```

### Variables de entorno

| Variable | Dónde se usa | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`) | servidor | URL del proyecto. No es secreta. |
| `SUPABASE_SECRET_KEY` | **solo servidor** | Secret key `sb_secret_...` (rol `service_role`). Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no se usa | Opcional; toda la lectura/escritura pasa por el servidor. |
| `ETL_PERMITIR_ESCRITURA` | servidor | En producción la escritura está bloqueada salvo `true`. |
| `NEXT_PUBLIC_MAPTILER_KEY` | navegador | Clave de MapTiler para el mapa de ciudades. Pública: restríngela por dominio. |

### Base de datos

Aplica la migración [`supabase/migrations/20261026000000_crear_mediciones_meteorologicas.sql`](supabase/migrations/20261026000000_crear_mediciones_meteorologicas.sql):

- Desde el panel: **SQL Editor** → pega el contenido → *Run*.
- O con la CLI: `supabase link --project-ref <ref>` y `supabase db push`.

Crea `mediciones_meteorologicas` con clave única `(ciudad, fecha_hora)`, restricciones de humedad
(0–100) y precipitación (≥ 0), valores finitos y **RLS activado sin políticas**: con la publishable
key no se puede leer ni escribir; solo el servidor, con la secret key, accede a la tabla. El script
se puede ejecutar varias veces y termina recargando el esquema de la API (`notify pgrst`).

## Cómo funciona el pipeline

```
Extracción → Transformación → Limpieza → Filtrado y selección → Carga
```

1. **Extracción** (`/api/open-meteo`): una petición por ciudad, en secuencia, con
   `timezone=GMT`, °C y mm. El servidor revalida el periodo (máx. 31 días). El JSON original se
   guarda intacto en memoria durante la sesión y se puede descargar. Si una ciudad falla se puede
   reintentar sola; su respuesta **sustituye** a la anterior, así que no se duplican datos.
2. **Transformación** (`lib/etl/transformacion.ts`): los arrays paralelos de `hourly` se
   convierten en un registro por ciudad y hora. Las horas se pasan a UTC aplicando
   `utc_offset_seconds` de forma explícita. Si los arrays tienen longitudes distintas se avisa y
   las posiciones incompletas se marcan. Los valores **no** se convierten: `null` sigue siendo `null`.
3. **Limpieza** (`lib/etl/limpieza.ts`): se rechaza todo registro sin ciudad, sin fecha válida o
   sin alguna de las tres mediciones como número finito; humedad fuera de 0–100; precipitación
   negativa. No hay umbrales para la temperatura. **Duplicados** por `(ciudad, fecha_hora)`: se
   conserva la **primera aparición válida** en el orden de extracción; las demás se rechazan
   indicando qué registro se conservó. Cada rechazo guarda su motivo.
4. **Filtrado y selección** (`lib/etl/filtros.ts`): `válidos → filtros → ordenación → selección`.
   La paginación solo afecta a la vista. Se suben **solo** las filas seleccionadas que cumplen los
   filtros actuales; las seleccionadas que quedan fuera se cuentan aparte. Cambiar los filtros
   nunca selecciona filas nuevas. Los excluidos por filtros siguen siendo válidos (no son rechazos).
5. **Carga** (`/api/supabase/cargar`): al pulsar *Subir* se **congela** una copia del conjunto y
   su orden (con una huella para compararlo con la vista previa). Se envía en lotes de ≤ 500 con
   *upsert* sobre `(ciudad, fecha_hora)`, uno tras otro. Un lote fallido no afecta a los ya
   completados y se puede reintentar. Después se **verifica** por lotes que cada clave enviada
   existe en destino (`/api/supabase/verificar`). Supabase no distingue filas insertadas de
   actualizadas en un upsert, así que la app no inventa ese desglose.

La pestaña **Datos en Supabase** lee lo que realmente está persistido (paginado, filtrado y con
`ORDER BY` explícito: una tabla no conserva el orden de inserción).

## Seguridad

- La secret key solo se lee en `lib/supabase/servidor.ts`, protegido con `server-only`.
- El servidor valida de nuevo cada registro, el tamaño del lote (≤ 500) y del cuerpo (≤ 256 KB),
  y rechaza claves repetidas dentro de un lote.
- No se registran credenciales en logs; los errores devueltos no incluyen secretos.
- **El proyecto no tiene autenticación.** Los endpoints quedan abiertos en desarrollo local. En
  producción la escritura devuelve 403 hasta que se proteja (autenticación, red privada…) y se
  defina `ETL_PERMITIR_ESCRITURA=true`. La lectura (`/api/supabase/datos`) también debe protegerse
  antes de publicar la aplicación.

## Pruebas

```bash
npm test                 # unitarias con fixtures controlados (nulos, duplicados, longitudes...)
npm run typecheck
npm run build

# Integración real (requiere red; las de Supabase, servidor en marcha y migración aplicada).
# Escribe 48 registros reales de Bilbao (2026-09-01 y 02) en la tabla.
INTEGRACION=1 ETL_BASE_URL=http://localhost:3000 npm run test:integracion
```

Los fixtures (`tests/fixtures`) solo se usan en las pruebas; la aplicación nunca los mezcla con
extracciones reales.

## Resumen de la entrega

### Lo construido

- **Aplicación Next.js** desplegada en Vercel con cinco apartados: Extracción, Pipeline, Mapa,
  Datos y Carga. Todos los textos están en castellano y la interfaz se adapta a pantallas pequeñas.
- **Extracción** desde la API histórica de Open-Meteo para 9 ciudades: varias a la vez, periodo
  configurable de hasta 31 días, resumen del volumen previsto y reintento por ciudad sin duplicar
  datos. El JSON original se conserva durante la sesión y se puede descargar.
- **Pipeline visual** con estado, entrada, salida y duración reales de cada fase:
  Extracción → Transformación → Limpieza → Filtrado y selección → Carga.
- **Transformación y limpieza**: los arrays paralelos se convierten en un registro por ciudad y hora
  en UTC. Los `null` no se convierten en cero, se validan los rangos, se eliminan los duplicados
  conservando la primera aparición y cada rechazo guarda su motivo.
- **Filtrado, ordenación y selección** antes de cargar, con contadores separados: extraído,
  válidos, rechazados, coinciden con los filtros y seleccionados.
- **Carga en Supabase** desde el servidor: lotes de 500, upsert por `(ciudad, fecha_hora)`, estado
  por lote, reintento de los lotes fallidos y verificación posterior de las claves.
- **Consulta del destino** («Datos en Supabase») con paginación, filtros y ordenación.
- **Visualización**: gráficas de calidad y comparativa por ciudad, evolución diaria y mapa interactivo
  (MapTiler) con vista de satélite, relieve 3D y globo.
- **Migración SQL** (`supabase/migrations/`) con la tabla `mediciones_meteorologicas`, las
  restricciones de humedad y precipitación, la clave única y RLS activado sin políticas públicas.

### Pruebas realizadas

| Verificación pedida | Cómo se comprueba | Resultado |
| --- | --- | --- |
| 1. Una ciudad durante un día: 24 registros en UTC | Unitaria (fixture) e integración real con Barcelona | Correcto |
| 2. Transformación de los arrays | Unitarias: orden, `utc_offset_seconds` y longitudes incoherentes | Correcto |
| 3. `null` sin convertir en cero | Unitarias de transformación y limpieza | Correcto |
| 4. Detección de duplicados | Unitaria: se conserva la primera aparición válida | Correcto |
| 5. Filtros y ordenación antes de paginar | Unitarias de filtros | Correcto |
| 6. Selección entre varias páginas | Unitarias de selección | Correcto |
| 7. Vista previa igual a lo enviado | Unitaria: mismo conjunto y mismo orden, lotes de ≤ 500 | Correcto |
| 8. Segunda carga sin duplicados | Integración real con Supabase | Correcto |
| 9. Fallo parcial de carga | Unitaria (simulado) e integración real (lote inválido) | Correcto |
| 10. Build y comprobación de tipos | `npm run build` y `npm run typecheck` | Sin errores |

`npm test` ejecuta 46 pruebas unitarias. Las de integración (7) se omiten por defecto: necesitan
red, el servidor en marcha y la migración aplicada, y se lanzan con `INTEGRACION=1` (ver
«Pruebas»). Los fixtures se usan solo en las pruebas y nunca se mezclan con datos reales.

### Bloqueos y pendientes

- **Sin autenticación.** Para poder cargar desde la versión publicada se ha definido
  `ETL_PERMITIR_ESCRITURA=true` en Vercel, así que cualquiera con el enlace puede escribir en la
  tabla. Antes de un uso real hay que proteger los endpoints o desactivar esa variable.
- La clave de MapTiler es pública por diseño. Conviene restringirla en MapTiler a los dominios
  de la aplicación.
- El archivo histórico de Open-Meteo publica los datos con algunos días de retraso. La aplicación
  avisa de ello, pero los días más recientes pueden llegar incompletos.
