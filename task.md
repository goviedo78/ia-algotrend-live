# Task: GONOVI — Estado del proyecto

> Cerebro compartido del equipo. Única fuente de verdad. Actualizar ANTES de pasar turno.
> Última actualización: **2026-05-29** por Claude.
> Versión histórica (Abr–22 May 2026) archivada en `task-archive-2026-05.md`.

---

## 🎯 Visión del proyecto

**gonovi.app** es la landing personal de la marca GONOVI (canal YouTube de Gonzalo + ecosistema de indicadores y herramientas). AlgoTrend es **uno** de los productos del ecosistema, no la marca madre.

El proyecto:
- **Hub `/official`** de 1 pantalla con logo 3D Materia + tarjetas alrededor → portal premium.
- **Linktree público `/links`** para compartir desde redes/videos (sin gate de mantenimiento).
- **Sub-productos** dentro de `/official/*` (Lab, Backtesting, Academia, Tienda, Checkout, Analytics, Monte Carlo, etc.).
- **Tracking NFC `/x/[id]`** para tarjetas físicas del personal branding.
- **Brand system pages** (`brand-3d.html`, `brand-motion.html`, `brand-system.html`) standalone.

## 🚨 Reglas inviolables

1. **Muro de "Próximamente" SIEMPRE activo** en `gonovi.app/`. Bypass único: `/?dev=BYPASS_TOKEN`. Solo Gonzalo decide cuándo quitarlo.
2. **NO tocar apps live** (`algotrend.gonovi.app`, `oro15.gonovi.app`, `oro300.gonovi.app`).
3. **AlgoTrend ≠ marca madre.** gonovi.app es brand personal GONOVI.
4. **Deploy a producción SIEMPRE** vía `npm run deploy:prod`. NUNCA `git push` solo (crea solo preview).
5. **Toda tabla nueva en `public` DEBE incluir** `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;` en su misma migración. Sin excepciones. (Regla agregada a `AGENTS.md` el 27-may.)
6. **maxLength obligatorio** en todo `<input>` / `<textarea>`. Sanitizar XSS en toda API que reciba texto del usuario.
7. **Nunca imprimir** API keys / secrets / valores de env vars en chat o logs.

---

## ✅ Estado actual: rutas y features

### Hub principal y sub-páginas

| Ruta | Status | Notas |
|---|---|---|
| `/official` | ✅ | Hub 1 pantalla, logo 3D Materia, 6 NavCards alrededor. Reloj NY live + BTC ticker. |
| `/official/lab` | ✅ | Trading Lab — 20 escenarios + tooltips ricos (mayo 26) |
| `/official/backtesting` | ✅ | BTC 5M delayed real + tooltips |
| `/official/academia` | ✅ | Trading Interactivo · scoring local |
| `/official/practica` | ✅ | Lobby que consolida Lab + Backtesting + Academia |
| `/official/estrategias` | ✅ | Histórico de operaciones + tooltips |
| `/official/mercados` | ✅ | Live desks BTC/Oro |
| `/official/store` | ✅ | Catálogo Pine Scripts. Lee `gumroad-products.json` |
| `/official/checkout` | ✅ | Pago simulado · entrega Pine Script por email · stablecoins UI |
| `/official/instalacion` y `/docs` | ✅ | Guía Pine Editor + FAQ |
| `/official/videos` | ✅ | Hub YouTube |
| `/official/community` | ✅ | WhatsApp + YouTube oficial |
| `/official/dashboard` | ✅ | Dashboard cliente · lee compras de localStorage |
| `/official/analytics` | ✅ | Métricas reales con PIN gate. Incluye tabla NFC apariciones + clicks de hub cards |
| `/official/montecarlo` | ✅ | Auditor estocástico con MT19937, Block Bootstrap, K-Ratio, 5 fases (mayo 22-26) |
| `/official/soporte` | ✅ | Tickets a `gonovi_support_tickets` (mig 003) + Resend email |
| `/official/legal/terms` y `/privacy` | ✅ | Páginas legales propias |
| `/official/live/btc-1h` | ✅ | Delayed público vía cache |
| `/official/links` | ✅ | **Dashboard admin (mayo 27-28)** para editar `/links` con drag-drop + preview iframe + iconos custom |
| `/official/analytics/nfc` | ✅ | **Dashboard NFC tracking (mayo 26)** con PIN, hora local, mapa, edición de nombres+redirects, refresh button |

### Linktree público + NFC

| Ruta | Status | Notas |
|---|---|---|
| `/links` | ✅ | Linktree público con MateriaLogo 3D, sponsor banner, bottom sheet pro, iconos line-art (mayo 27-28) |
| `/x/[id]` | ✅ | Endpoint tracking NFC físico con redirect 302 + cookie 1y + insert no-bloqueante (mayo 26) |

### Sistema de cuenta

| Ruta | Status | Notas |
|---|---|---|
| `/auth` | ✅ | OTP email en 2 pasos + honeypot |
| `/account` | ✅ | Panel con 4 cards (Compras, Progreso, Alertas, Soporte) |

### Páginas brand standalone

| Ruta | Status | Notas |
|---|---|---|
| `/brand-3d.html` | ✅ | Logo 3D con three.js + gyroscope iOS (mayo 27 fix) |
| `/brand-motion.html` y `/brand-system.html` | ✅ | Preview brand assets |

---

## 🗃️ Base de datos (Supabase)

Migraciones aplicadas al remoto:

| # | Archivo | Qué hace |
|---|---|---|
| 001 | `official_schema.sql` | Tablas base: products, licenses, orders, learning_scenarios/attempts, analytics_events, partners |
| 002 | `auth_schema.sql` | profiles, support_tickets, push_subscriptions, lab_progress + RLS |
| 003 | `gonovi_support_tickets.sql` | Tabla aislada GONOVI (shared support_tickets con Dolcato) |
| 004 | `montecarlo_simulations.sql` | `simulaciones_montecarlo` para Monte Carlo Auditor |
| 005 | `montecarlo_retention.sql` | RPC de retención (max 5 audits / 30 días) |
| 006 | `nfc_analytics.sql` | Escaneos NFC (IP hasheada, headers Vercel, RLS) |
| 007 | `nfc_card_names.sql` | Mapeo card_id → nombre legible |
| 008 | `nfc_card_redirects.sql` | URL custom por tarjeta NFC |
| 009 | `explicit_grants_supabase_v2.sql` | GRANTs explícitos para breaking change Oct/2026 |
| 010 | `default_privileges_least_privilege.sql` | Default privileges restrictivos para tablas futuras |
| 011 | `links_config.sql` | JSONB single-row para config del `/links` editable |

**Todas las tablas tienen RLS habilitado.** Regla nueva en `AGENTS.md`.

---

## 🤖 Equipo de agentes

| Agente | Pane tmux | Rol | Última actividad |
|---|---|---|---|
| **Claude (Opus 4.7)** | `0.0` | Co-arquitecto, seguridad, orquestación | Activo (sesión actual) |
| **Codex** | `0.1` | Ingeniero backend / consola | Última: Fase 4 soporte (22-may) |
| **Gemini Pro** | `0.2` | UI / lógica compleja / análisis | Activo (estilos /links) |
| **Antigravity IDE** | — | Desktop IDE alternativo | Usado puntualmente |

### Mensaje a otro agente

```
# Claude (panel 0.0)
tmux send-keys -t GONOVI_LANDING:0.0 "Claude, ..." C-m

# Codex (panel 0.1) — UN C-m
tmux send-keys -t GONOVI_LANDING:0.1 "Codex, ..." C-m

# Gemini (panel 0.2) — DOBLE C-m (siempre)
tmux send-keys -t GONOVI_LANDING:0.2 "Gemini, ..." C-m
tmux send-keys -t GONOVI_LANDING:0.2 "" C-m
```

---

## 📜 Cambios recientes (chronicle 22-may → 28-may)

### 29-may
- **Fase 8 XSS hardening completada** (commit `0d5e455`):
  - `/api/push/send` ahora requiere auth (cookie dashboard O Bearer cron secret) + `clampString` (strip control chars + `<` `>` + truncate). Antes era endpoint abierto.
  - `/api/analytics/event` + `/api/analytics/track` truncan path/referrer/card_id/card_title/type defensivamente.
  - maxLength agregado: pushTitle (100), pushBody (300), dashboard password (200), SVG textarea (20000). AuthForm/VideosPage ya tenían.
- **Workflow BTC cron VIVO en GitHub Actions** (id 285366197, active):
  - `gh auth refresh -s workflow` ejecutado, scopes ahora: gist, read:org, repo, workflow.
  - `.github/workflows/btc-cron.yml` pusheado a main remoto. Schedule: minuto 2 cada hora UTC.
  - Fix: cambiado POST → GET para matchear el route handler (commit `76e7d04`).
  - Fix: reseteado GitHub secret `CRON_SECRET` porque tenía `\n` literal igual que en Vercel (rompía auth header).
  - Validado con `workflow_dispatch` manual → HTTP 200, response `{"ok":true,"actions":[]}`.
- **Deploy A consolidado**: merge de 132 commits feat→main, deploy `dpl_6uszmop8a` (alias gonovi.app). 8/8 smoke tests OK. Backup tag `pre-merge-2026-05-28` apuntando al estado pre-merge.
- **BingX safety**: `BINGX_BTC_QUANTITY` Vercel env bajado de `1` a `0.0001`. Defensa: si pasamos a REAL por error, opera ~$7 en vez de $73k.
- **main local + remoto sincronizados** (HEAD `76e7d04`). Otra worktree en `/Documents/...` también al día.
- **Verificado fix BingX en producción**: archivo deployado tiene 6 menciones de `safeExecuteBingx` (antes: 0). Esperando próximo trade BTC natural para validar end-to-end.

### 28-may
- **Cleanup masivo del repo**: borrados archivos junk (HIDScanner, MacropadConfigurator, debug-*, screenshots, etc.) + `svg/`, `test-3d.mjs`, `test-db.js`.
- **Bug fix crítico de Vercel**: `IconDisplay.tsx` estaba untracked → 8 previews failed. Trackeado + commiteado (`c25be52`)
- **task.md reescrito** al día. Viejo archivado en `task-archive-2026-05.md`
- Bronze pastel reemplaza pulse orange en hover/focus de pills de `/links`. Stagger entry por nth-child (fix mobile Safari)

### 27-may
- **Bottom sheet** en `/links` al tocar un link (preview pro estilo Instagram)
- **Iconos SVG custom subibles** desde dashboard `/official/links` con sanitización XSS server-side
- **Dashboard `/official/links` PRO** con drag-drop, preview iframe, color picker, edición full
- **Migración 011** `links_config` JSONB editable runtime
- **CSP fix**: `X-Frame-Options DENY → SAMEORIGIN` para que el iframe del preview funcione
- **Default privileges** Supabase least-privilege (mig 010, defensa en depth)
- **Regla nueva RLS** agregada a `AGENTS.md` + memoria persistente

### 26-may
- **Sistema NFC tracking `/x/[id]`** (mig 006) — tarjetas físicas, redirect 302, cookie 1y
- **Dashboard `/official/analytics/nfc`** con hora local, mapa, nombres de tarjetas (mig 007)
- **URL custom por tarjeta NFC** (mig 008) — redirect configurable
- **Banner sponsors** en `/links`
- **Brand-3d.html fix CSP** (unpkg + Google Fonts en allow-list) + botón Activar movimiento iOS
- **GitHub Actions cron BTC** declarativo (workflow YAML local, pendiente push hasta refresh scope)

### 22-may (Monte Carlo + Tooltips)
- Monte Carlo Auditor v2: MT19937 PRNG, Block Bootstrap, Sharpe anualizado, K-Ratio, 5 fases
- Tooltips ricos en Monte Carlo + Lab + Backtesting + Estrategias

### Pre-22-may
- Toda la planificación original del task.md (archivado). Hub + sub-páginas + auth + checkout + brand system.

---

## ⏳ Pendientes

### Decisión de Gonzalo (no técnicas)
1. **Pasar BingX a REAL**: hoy `BINGX_USE_DEMO=true`. Validación previa recomendada: esperar 1 trade BTC en DEMO con `bingx_order_open code=0` + `bingx_order_close code=0` en `algotrend_events`. Recién ahí flip a `false`. Quantity ya está en 0.0001 defensivo.
2. **NFC v4 (#34)**: enunciado "refresh + restyle brand-3d + clarificar card_id físico" no tiene descripción operativa. Ni Claude ni Gemini pudieron inferir qué cambio concreto pide. Decidir: skip o detallar.

### Backlog del plan original
- **Stablecoins en checkout**: hoy es placeholder ("dirección se genera al confirmar"). Cuando vaya en serio, integrar generación real de wallets.

### Mejoras opcionales detectadas
- Auditoría a11y / mobile del `/links` con Gemini (idea pendiente de ronda anterior)
- TradingView webhooks de BTC: Gonzalo confirmó que BTC viene "directo de la app", no de TradingView. El cron horario + frontend cubre el flow. Item cerrado.

---

## 🔐 Env vars críticas (Vercel Production)

```
BYPASS_TOKEN              · valor actual: 'materia' (gate del muro)
OFFICIAL_ENABLED          · 'true' habilita /official
ANALYTICS_PIN             · PIN para dashboards admin (analytics, nfc, links)
DASHBOARD_PASSWORD        · fallback del PIN
NEXT_PUBLIC_SUPABASE_URL  · público
NEXT_PUBLIC_SUPABASE_ANON_KEY · público
SUPABASE_SERVICE_ROLE_KEY · admin operations server-side
CRON_SECRET               · auth del cron /api/cron/check
NFC_HASH_SALT             · sha256 salt para IP hash de NFC scans
BINGX_API_KEY/SECRET_KEY  · trading auto
BINGX_TRADING_ENABLED     · feature flag trading
BINGX_USE_DEMO            · 'true' = testnet VST
BINGX_BTC_QUANTITY        · cantidad por trade
BINGX_LEVERAGE            · leverage
```

---

## 📞 Cómo el equipo coordina ahora

1. **Antes de tocar archivos**: leer este `task.md` + `AGENTS.md` + `CLAUDE.md`.
2. **Si vas a tocar `/links`**: leer también `.claude/briefs/links-page-context.md` (5 archivos permitidos, reglas estrictas).
3. **Al terminar una tarea**: actualizar este `task.md` con un bullet en "Cambios recientes" + commit + push.
4. **Deploy**: SIEMPRE `npm run deploy:prod`, jamás `git push` solo.
5. **Si se rompe algo**: revisar `git status` y verificar que no haya archivos `??` en `src/` o `supabase/migrations/`.

---

*Hecho con paranoia profesional. Si no entendés algo, preguntá antes de tocar.*
