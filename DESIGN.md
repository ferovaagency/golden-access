# Ferova One — Sistema visual

Fuente única de verdad: los tokens `--fv-*` en `src/index.css` (bloque al inicio).
Todo lo demás (`--primary`, `--ferova-brand`, `--danger`, `--ferova-radius-*`, `--ferova-shadow`…)
son **alias** que apuntan a `--fv-*`. Cambia un valor canónico y cascada a toda la plataforma.

> **Regla de oro:** al escribir UI nueva, usa `--fv-*` (o las clases Tailwind equivalentes).
> No introduzcas hex sueltos ni nuevos nombres de token.

---

## Color

### Marca
| Token | Valor | Uso |
|---|---|---|
| `--fv-brand` | `#2563EB` | Acción principal: botones, pestañas activas, enlaces. |
| `--fv-brand-strong` | `#1D4ED8` | Hover / énfasis del azul. |
| `--fv-brand-deep` | `#1E3A8A` | Navy para gráficas y acentos oscuros. |
| `--fv-accent` | `#6366F1` | Índigo: insignias/elementos de IA. |

### Superficies
| Token | Valor | Uso |
|---|---|---|
| `--fv-canvas` | `#F8FAFC` | Fondo de la app. |
| `--fv-surface` | `#FFFFFF` | Tarjetas y paneles. |
| `--fv-soft` | `#F1F5F9` | Superficie tenue, hover de filas. |
| `--fv-tint` | `#EFF6FF` | Tinte azul muy claro. |
| `--fv-ai` | `#EEF2FF` | Fondo de elementos de IA. |
| `--fv-line` | `#E2E8F0` | Bordes y divisores (1px). |

### Texto (jerarquía)
| Token | Valor | Uso |
|---|---|---|
| `--fv-ink` | `#0F172A` | Títulos y texto principal. |
| `--fv-ink-2` | `#334155` | Secundario fuerte. |
| `--fv-muted` | `#64748B` | Texto de apoyo. |
| `--fv-subtle` | `#94A3B8` | Metadatos, placeholders. |

### Estado (fuerte + tinte suave)
| Rol | Fuerte | Suave |
|---|---|---|
| Éxito / positivo | `--fv-success` `#16A34A` | `--fv-success-soft` `#DCFCE7` |
| Advertencia | `--fv-warning` `#CA8A04` | `--fv-warning-soft` `#FEF9C3` |
| Peligro / negativo | `--fv-danger` `#DC2626` | `--fv-danger-soft` `#FEE2E2` |
| Info | `--fv-info` `#2563EB` | `--fv-info-soft` `#DBEAFE` |
| Violeta (score/IA) | `--fv-violet` `#7C3AED` | `--fv-violet-soft` `#EDE9FE` |

**Reglas de contraste**
- Texto sobre azul saturado (`bg-blue-500..800`, `--fv-brand`): **siempre blanco y bold** (ya forzado por CSS).
- Semáforos: verde ≥80% / ámbar 40–79% / rojo <40% (patrón usado en KPIs, presupuesto, cumplimiento).
- Texto de apoyo: `--fv-muted`; nunca bajar de 4.5:1 sobre superficie clara.

---

## Tipografía
- **Display** (`--font-display`, Outfit): títulos de sección y héroes.
- **Sans** (`--font-sans`, Figtree): cuerpo y UI.
- **Mono** (`--font-mono`): solo datos/medidas y etiquetas técnicas cortas, no como decoración.
- Escala típica en la app: `text-[10px]` etiquetas · `text-xs` datos densos · `text-sm` cuerpo · `text-lg/xl/2xl` títulos.

## Radios
`--fv-radius-xs 8` · `sm 10` · `md 12` (controles) · `lg 14` (tarjetas) · `xl 18` (héroes) · `pill 999`.

## Sombras (offset + blur, nunca halo plano)
- `--fv-shadow-sm` reposo de tarjeta · `--fv-shadow-md` elevación media · `--fv-shadow-lg` hover/overlays.

---

## Componentes (patrones vigentes, sin librería externa)
No usamos shadcn: son componentes propios con Tailwind inline. Patrones a mantener:
- **Botón primario:** `bg-blue-600 text-white font-semibold rounded-lg px-3 py-2 hover:bg-blue-700` (texto blanco+bold garantizado por CSS).
- **Botón secundario:** `border border-slate-200 text-slate-700 rounded-lg px-3 py-2 hover:bg-slate-50`.
- **Tarjeta:** `rounded-lg/2xl border border-slate-200 bg-white p-4/5 shadow-sm`.
- **Chip de estado:** `rounded-full px-2 py-0.5 text-[10px] font-semibold` con el par fuerte/suave del rol.
- **Fila de tabla densa:** `border-b border-slate-100`, cabecera `text-xs text-slate-500`.
- **Popup/modal:** overlay `fixed inset-0 bg-slate-950/40` + tarjeta `max-w-* rounded-2xl bg-white shadow-2xl` (patrón del popup de tarea del Planner).

## Cómo adoptarlo (incremental, sin romper nada)
1. Los alias ya hacen que TODO consuma `--fv-*` — no hay regresión visual.
2. En cada pantalla que toques, reemplaza hex sueltos por el token del rol correspondiente.
3. Migrar pendiente: las tintas cálidas `--ferova-positive/warning/danger` (`#E3F4EB/#F3EAD6/#F7E3E4`) del tema v2 aún son un set aparte; unificarlas a los `*-soft` de `--fv-*` cuando se rediseñe cada módulo.
4. Verificación sin preview local: `npx tsc --noEmit && npx vite build`.
