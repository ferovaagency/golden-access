# Plan: Ferova OS → SaaS (Supabase + PayPal Paywall)

## Resumen

Sustituyo la plantilla TanStack Start vacía de este proyecto Lovable por el código real del repo público `github.com/ferovaagency/Ferova-OS-financie` (Vite + React 19). Sobre ese código aplico los 5 cambios solicitados: migración Firebase→Supabase con scopes de Google Sheets/Drive, Paywall de PayPal, flujo de 4 estados en `App.tsx`, y script SQL para `user_subscriptions`. Los componentes `Dashboard`, `VentasAdmin` y la lógica de `sheetsService.ts` / `calculations.ts` se preservan sin cambios.

## Paso 1 — Reemplazo del stack

Borro todo lo de TanStack Start del proyecto actual:
- `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/styles.css`, `src/routeTree.gen.ts`
- `src/routes/` (entero)
- `src/lib/error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts`
- `src/hooks/`, `src/components/ui/`
- `vite.config.ts`, `tsconfig.json`, `components.json`

Copio desde el repo a la raíz del proyecto:
- `index.html`, `vite.config.ts`, `tsconfig.json`, `metadata.json`
- `src/main.tsx`, `src/index.css`, `src/types.ts`
- `src/components/` (todos los componentes existentes, incluidos `Dashboard`, `VentasAdmin`, etc.)
- `src/lib/calculations.ts`, `src/lib/sheetsService.ts`
- `node-domexception-mock/` y el override en `package.json`

**No copio**: `src/lib/firebase.ts` (se reemplaza), `firebase-applet-config.json`, `src/App.tsx` (se reescribe).

## Paso 2 — Dependencias (`package.json`)

Base del repo + cambios:
- **Quitar**: `firebase`
- **Añadir**: `@supabase/supabase-js`, `@paypal/react-paypal-js`
- Mantengo: `@google/genai`, `recharts`, `lucide-react`, `motion`, `xlsx`, `react@19`, etc.

## Paso 3 — Cliente Supabase (`src/lib/supabase.ts`)

Nuevo archivo. Clave publishable hardcodeada (`sb_publishable_b5j2ar7b9fz2XNr95JwYCQ_Eyasabcn`) y URL del proyecto (te pediré la URL `https://<ref>.supabase.co` si no la tengo). Exporta:

- `supabase` (cliente)
- `signInWithEmail(email, password)`
- `signUpWithEmail(email, password)`
- `signInWithGoogle()` → llama `signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file', queryParams: { access_type: 'offline', prompt: 'consent' } } })`
- `signOut()`
- `onAuthStateChange(cb)` → reexporta el listener nativo, devolviendo `{ session, providerToken }`
- `getCurrentSession()`

## Paso 4 — Paywall (`src/components/Paywall.tsx`)

- Envuelve con `PayPalScriptProvider` (client-id desde `import.meta.env.VITE_PAYPAL_CLIENT_ID`, currency USD)
- UI: tarjeta centrada, fondo `#0f0e0c`, borde `#2a2620`, acentos `#c9a961`, tipografía clara, lista de beneficios, precio (placeholder $29 USD/mes — confirmable)
- `PayPalButtons` con `createOrder` (monto fijo) y `onApprove`:
  - `actions.order.capture()` → obtiene `orderID`
  - `supabase.from('user_subscriptions').insert({ user_id, status: 'active', paypal_order_id })`
  - Llama `onPaid()` callback para que `App.tsx` reevalúe el estado
- Botón secundario "Cerrar sesión"

Necesito el **PayPal Client ID** como secret `VITE_PAYPAL_CLIENT_ID` (build secret en Workspace Settings, o lo expongo con `define` en `vite.config.ts` desde un secret runtime). Te lo pediré tras aprobar el plan.

## Paso 5 — Refactor `src/App.tsx` (flujo de 4 estados)

Estado interno:
```ts
{ session, providerToken, hasPaid, loading }
```

Lógica de render:

1. **`loading`** → splash dorado
2. **`!session`** → `<AuthScreen />` (componente nuevo: form email/password + botón Google con scopes)
3. **`session && !hasPaid`** → `<Paywall user={session.user} onPaid={refresh} />`
4. **`session && hasPaid && !providerToken`** → pantalla de bloqueo con botón dorado "Conectar con Google Workspace" que llama `signInWithGoogle()`
5. **`session && hasPaid && providerToken`** → `await bootstrapSheets(providerToken)` y renderiza el `<Dashboard />` original (sin tocar su lógica interna)

`hasPaid` se calcula con: `supabase.from('user_subscriptions').select('status').eq('user_id', uid).eq('status','active').maybeSingle()`.

`providerToken` se obtiene de `session.provider_token` tras OAuth de Google. Se persiste en `sessionStorage` para sobrevivir refreshes (Supabase no lo guarda).

`sheetsService.ts` se adapta mínimamente para recibir el token desde el nuevo cliente en vez de Firebase (cambio puntual: reemplazo del getter de token, no de la lógica de Sheets).

## Paso 6 — SQL para Supabase

Incluyo en el README o en comentario al inicio de `supabase.ts`:

```sql
create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('active','cancelled','expired')),
  paypal_order_id text not null,
  created_at timestamptz default now(),
  unique (user_id, paypal_order_id)
);

grant select, insert on public.user_subscriptions to authenticated;
grant all on public.user_subscriptions to service_role;

alter table public.user_subscriptions enable row level security;

create policy "users read own subs"
  on public.user_subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy "users insert own subs"
  on public.user_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);
```

Además, instrucciones para configurar en el panel de Supabase: Authentication → Providers → Google (Client ID/Secret de Google Cloud con scopes Sheets+Drive), y agregar el dominio de Lovable a Redirect URLs.

## Lo que no toco

- `Dashboard.tsx`, `VentasAdmin.tsx`, demás componentes del repo: se copian tal cual.
- `calculations.ts`: sin cambios.
- `sheetsService.ts`: único cambio es cómo obtiene el token (un parámetro vs Firebase).

## Riesgos / advertencias

- **Insert desde cliente del registro de pago es inseguro** (un usuario puede insertar `status='active'` sin pagar). Lo ideal sería verificar el pago server-side via webhook de PayPal, pero el prompt pide insert directo desde `onApprove`. Lo implemento como pediste, pero te lo señalo.
- **`provider_token` de Google expira** (~1h) y Supabase no refresca tokens de proveedores OAuth automáticamente. El usuario tendrá que re-conectar Google periódicamente o implementar refresh tokens server-side (fuera del alcance de este plan).
- **`VITE_PAYPAL_CLIENT_ID`** debe configurarse como **Build Secret** en Workspace Settings → Build Secrets (las variables `VITE_*` se inyectan en build, no en runtime). Te guío para hacerlo tras aprobar.
- Necesitaré la **URL del proyecto Supabase** (`https://<ref>.supabase.co`) — la clave pública sola no basta.
