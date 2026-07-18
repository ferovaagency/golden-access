
# Ferova OS — Redesign Plan

Goal: transform Ferova from a modular CRM/Finance tool into a clean, Apple/Linear-style operating system for entrepreneurs. **No business logic, no Supabase schema, no auth flow changes.** Only shell, navigation, Home, Planner, AI placement, and onboarding.

---

## 1. Remove AI Studio residue

- Rewrite `README.md` as a Lovable project readme.
- Rewrite `metadata.json` (drop `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, AI Studio link).
- Remove `.env.example` `GEMINI_API_KEY` / `APP_URL` block, replace with Lovable Cloud note.
- Update `index.html` title/description to "Ferova OS".
- Grep for "AI Studio", "ai.studio", "GEMINI_API_KEY" references and clean.

## 2. New app shell (`src/App.tsx` refactor, no logic changes)

Replace current tab-bar layout with a 3-column shell:

```text
┌──────────┬──────────────────────────────┬───────────────┐
│ Sidebar  │  Main content (route view)   │  AI Sidebar   │
│ (nav)    │                              │  (collapsible)│
└──────────┴──────────────────────────────┴───────────────┘
```

New primary nav (left rail, icon+label, collapsible):
- Home
- Workspace (existing Dashboard + quick capture)
- Projects (existing `ProyectosAdmin`)
- Modules ▾
  - Finance (Ventas, Gastos, Horas, Servicios, Equilibrio, Impuestos — grouped, unchanged internals)
  - CRM (existing `AdminCRM` / `CustomerCRM`)
  - Smart Planner (new — see §4)
  - WhatsApp (existing panel inside CRM, surfaced as module)
  - LinkedIn (existing)
  - Reddit (existing)
- Settings ▾
  - Company, Users, Integrations, Appearance, AI, Permissions, Billing
  - Maps to existing `ConfigAdmin`, `ClientesAdmin`, Google connect, Paywall — grouped, not rebuilt.

All existing components are re-mounted inside the new shell. Their internals stay intact.

## 3. Home — Executive Dashboard (new `src/components/Home.tsx`)

Reads from existing services (`financeService`, `crmService`, `planService`) — no new queries beyond aggregation. Sections:

1. **Today's priorities** (max 5) — pulls open oportunidades w/ `siguiente_accion`, overdue abonos, low-cash alerts, tasks from planner.
2. **Business health** — 5 KPI cards using existing finance calcs: cash, AR, monthly revenue, today's hours, profitability.
3. **Blind Spots** — calls existing `business-assistant-chat` edge function with a short "insights" prompt (reuses infra, no new function). Renders 3–5 bullet insights.
4. **Quick access** — 5 large tiles: Planner, Projects, Finance, CRM, AI.

No charts. Whitespace-heavy layout.

## 4. Smart Planner (new module, self-contained)

New files:
- `src/components/SmartPlanner.tsx` — UI (brain dump input, today/week views, time blocks).
- `src/lib/plannerService.ts` — Supabase CRUD.
- Minimal new tables via `supabase--migration` (only unavoidable schema change):
  - `planner_tasks` (title, notes, energy, priority, due_at, block_start, block_end, status, project_id nullable, user_id)
  - `planner_habits` (title, cadence, streak, user_id)
  - With GRANTs + RLS scoped to `auth.uid()`.
- Auto-scheduling is client-side heuristic v1 (energy + priority + free blocks). No ML.

This is the one place new tables are needed; everything else reuses existing schema.

## 5. Permanent AI sidebar

- Extract current `BusinessAssistant` into a right-side dockable panel (`src/components/AISidebar.tsx`) mounted in the shell, not floating.
- Collapsible (icon rail) + resizable (drag handle, width persisted to localStorage).
- Reuses existing `business-assistant-chat` edge function verbatim.
- System prompt tightened: max 6 lines, always end with "Suggested actions:" list. Prompt edit only, no function signature change.

## 6. Onboarding (redesign `OnboardingChat.tsx` presentation only)

Convert to one-question-per-screen wizard using existing state fields (`business_profile`). Steps: name → solo/team → currency → timezone → business type → working hours → integrations (Google/WhatsApp/Notion optional) → theme. Same save payload as today.

## 7. Design system

Update `src/index.css`:
- Introduce semantic tokens: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--accent`.
- Light theme default, dark theme via `[data-theme="dark"]`.
- Radius scale (`--r-sm/md/lg`), soft shadow tokens, 8pt spacing.
- Typography: keep Outfit/Figtree, tighten scale.
- Remove `.ferova-light-theme` overrides (legacy dark→light patches) once shell is on tokens.

Density / large-text / dark-mode toggles live in Settings → Appearance, stored in localStorage.

## 8. What stays untouched

- All `supabase/functions/*` (except Home insights prompt reuse).
- `financeService`, `crmService`, `businessProfileService`, `sheetsService`, `planService`, auth, PayPal, Google OAuth, WhatsApp/Evolution wiring.
- Existing admin components — re-mounted, not rewritten.

## 9. Delivery order (single implementation pass)

1. Cleanup AI Studio references + `index.html` metadata.
2. Design tokens in `index.css`.
3. New shell in `App.tsx` + `AppSidebar.tsx` + `AISidebar.tsx`.
4. `Home.tsx` executive dashboard.
5. Planner migration + `SmartPlanner.tsx` + service.
6. Onboarding wizard refactor.
7. Settings grouping page.
8. Typecheck, visual check via Playwright screenshot.

## 10. Risks

- Planner tables are the only schema change — small, additive, RLS-scoped, safe.
- Re-mounting existing components inside a new shell may surface stale `.ferova-light-theme` selectors; will migrate incrementally, leaving overrides in place until each screen is verified.
- AI sidebar always-on will increase Lovable AI usage only when user chats — no background polling.

---

Confirm and I'll implement in the order above.
