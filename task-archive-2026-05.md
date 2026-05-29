# Task: Construcción Landing GONOVI Official

Cerebro compartido del equipo. Única fuente de verdad. Actualizar ANTES de pasar turno.

## Estado Actual del Landing

### ✅ CONSTRUIDO (existe el componente + ruta)
- [x] **Hero inmersivo** — Logo 3D Materia, tarjetas de navegación laterales, título, CTAs
- [x] **Demos de indicadores** — BTC 1H, Oro 15M, Oro 30M como vitrinas live
- [x] **Instalación TradingView** — Guía de 4 pasos + FAQ (`/official/instalacion`)
- [x] **Venta y licencias** — Gumroad → Checkout propio → Stablecoins (sección)
- [x] **Base central** — Schema de datos + Roadmap (sección)
- [x] **Trading Lab** — Quiz gráfico con mock (`/official/lab`) — TradingLabPage.tsx + CSS
- [x] **Backtesting Libre** — Práctica 5M vela a vela (`/official/backtesting`) — BacktestingPage.tsx + CSS
- [x] **Comunidad** — WhatsApp, YouTube, Email, Partners (sección)
- [x] **Dashboard interno** — CTR, Retención, Ventas, Learning (sección placeholder)
- [x] **BTC Delayed público** — Commit `fff66ed` por Codex ✅
- [x] **DB schema migration local** — `supabase/migrations/001_official_schema.sql` creado con tablas oficiales base.

### 🔲 POR CONSTRUIR (planeado pero no implementado aún)
- [x] **Trading Lab funcional** — YA COMPLETO: 20 escenarios hardcodeados, lógica hide-future, long/short/no operar, reveal en R, resumen de ronda, sessionStorage. (`TradingLabPage.tsx` + `trading-lab-scenarios.ts`)
- [x] **Backtesting funcional** — BTC 5M real delayed, avance vela a vela, entrada/stop/target editable, resultado en R
- [x] **Tienda propia** — Catálogo real con 3 productos (BTC 1H, Gold 15M, Gold 30M): descripción, features, "Ver demo" + "Obtener acceso" → Gumroad. Actualizar URLs en `storeProducts[]` en `OfficialHome.tsx` con links reales de Gumroad.
- [x] **Academia interactiva** — Ruta `/official/academia`, retos gráficos, scoring localStorage, progreso sin login
- [x] **Dashboard interno real** — `/official/analytics` conectado a Supabase: tráfico, push, devices, sponsor, trades, PnL, PIN via `?pin=`.
- [x] **Checkout propio** — Ruta `/official/checkout`, formulario de orden local, producto, TradingView, metodo de pago y resumen
- [x] **Stablecoins** — USDC/USDT en checkout con selector de red, monto, dirección placeholder y referencia local
- [x] **DB schema migration** — Crear tablas base solicitadas: products, licenses, orders, learning_scenarios, learning_attempts, analytics_events, partners

## Equipo Activo

| Agente | Rol | Estado |
|---|---|---|
| **Antigravity (Opus)** | Orquestador, Arquitecto | Auditando estado del proyecto |
| **Claude (1:1.0)** | Co-Arquitecto, Seguridad | Revisando public-delayed |
| **Codex (1:1.1)** | Ingeniero de Consola | ✅ Commit BTC delayed hecho |

## Decisiones
- Proyecto es 100% LOCAL. No push ni deploy.
- NO tocar apps live (BTC 1H, ORO15, ORO300).
- Graphify ya está integrado y contemplado por Claude/Codex.
- **Regla Estricta de Seguridad (Permanente)**: TODO `<input>` o `<textarea>` en el proyecto DEBE incluir la propiedad `maxLength` correspondiente. CUALQUIER API que reciba texto libre del usuario DEBE sanitizar su entrada removiendo tags HTML y reduciendo tamaño antes de procesarlo, previniendo XSS e inyecciones.

## 📞 Guía Telefónica: Delegación entre Agentes (IMPORTANTE)
Todos los agentes (Claude, Codex, Gemini) tienen permiso para usar la terminal y el comando `tmux`. Si necesitas delegar una tarea a un compañero o pedirle que revise tu código, debes enviarle un mensaje directo a su panel.

**Directorio de Paneles:**
*   **Para despertar a Claude (Arquitectura/Seguridad):** `tmux send-keys -t GONOVI_LANDING:0.0 "Claude, revisa esto..." Enter`
*   **Para despertar a Codex (Ingeniero Backend/Consola):** `tmux send-keys -t GONOVI_LANDING:0.1 "Codex, avanza con..." Enter`
*   **Para despertar a Gemini Pro (Análisis/Lógica Compleja):** `tmux send-keys -t GONOVI_LANDING:0.2 "Gemini, analiza..." Enter`

*Regla de Oro: Siempre que termines una tarea, actualiza este `task.md` marcando el progreso y luego envíale un ping por `tmux` al compañero correspondiente para pasarle el turno.*

## Handoff Notes
Codex completó commit `fff66ed`. Antigravity auditó OfficialHome.tsx (479 líneas, 8 secciones). Las secciones del landing existen como UI pero la mayoría son mockups estáticos sin lógica real conectada a Supabase.
Codex creó migración local `supabase/migrations/001_official_schema.sql` con RLS habilitada y sin policies públicas por defecto.
Codex ejecutó `vercel env pull --environment=production`, agregó `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde Supabase CLI sin imprimir la key, y reaseguró `PUBLIC_DELAY_HOURS=24` en `.env.local`.
Codex convirtió Backtesting Libre a datos reales BTC 5M usando `/api/public/candles/btc-5m`; permite avanzar 1/5/15 velas, definir Long/Short/Skip, editar entrada/stop/target y calcular resultado en R.
Codex ejecutó `npm run lint` con resultado OK. Smoke test local con `npm run dev` fue cancelado por instrucción del usuario; no queda servidor Next corriendo desde Codex.
Codex construyó Academia Interactiva en `src/components/official/academia/` y ruta `/official/academia`; funciona sin login con retos gráficos, reveal de futuro, scoring XP/WR/racha en localStorage y enlaces desde OfficialHome.
Codex construyó Checkout Propio en `src/components/official/checkout/` y ruta `/official/checkout`; captura producto/email/TradingView/metodo, genera orden local en localStorage y actualizó CTAs de compra de OfficialHome hacia el checkout.
Codex amplió `/official/analytics` para usar métricas reales existentes de Supabase: pageviews, notificaciones, dispositivos push, sponsor stats y performance de trades.
Codex agregó flujo stablecoin al checkout: método USDT/USDC, selector ERC20/Polygon/TRC20, wallet placeholder, monto del producto y referencia local de orden.
Codex ejecutó `npm run lint` al final de Academia + Checkout + Analytics + Stablecoins con resultado OK.

### 🔄 Sincronización de Agentes (PRUEBA EN CURSO)
- **Gemini**: Lanzó el reto: `(17 * 3) + (144 / 12) = ?`
- **Codex**: `63`
- **Claude**: 63 × 2 = **126** ✅

**Prueba de sincronización COMPLETADA.** Resultado final enviado a Gemini: 126.

### ✅ Auditoría de compilación — Codex (2026-05-13)
- `npm run lint`: OK, sin errores.
- `npx tsc --noEmit`: OK, sin errores TypeScript.
- `git status --short`: worktree con cambios previos/no trackeados de varios agentes; no se revirtieron ni tocaron cambios ajenos.
- Rutas oficiales verificadas con `page.tsx` existente: `/official/lab`, `/official/backtesting`, `/official/academia`, `/official/checkout`, `/official/instalacion`, `/official/analytics`.
- Enlaces desde `OfficialHome.tsx`: las rutas anteriores están enlazadas correctamente desde tarjetas/CTAs/sección analytics.
- Gumroad en `storeProducts[]`: `buyHref` apunta al checkout propio (`/official/checkout?product=...`), no a URLs directas de Gumroad. Gumroad real existe como fallback dentro de `/official/checkout` (`https://gonovi.gumroad.com`). Hallazgo no bloqueante de compilación, pero requiere decisión de producto si `storeProducts[]` debe llevar directo a Gumroad o mantener checkout propio.
- No se tocó Hero ni secciones visuales secundarias.

### 🎨 Rediseño Hero — Claude (2026-05-13)
Cambios aplicados en `OfficialHome.tsx` (solo sección hero) y `official-home.module.css` (solo clases hero):
- **Logo 3D**: `logoStage` ampliado a `min(56vw, 740px)` × `min(72svh, 740px)`. En tablet `min(90vw, 660px)` × `clamp(24rem, 52vw, 38rem)`. En mobile `min(96vw, 470px)` × `clamp(17rem, 68vw, 24rem)`.
- **Halo animado**: `@keyframes haloPulse` 5s ease-in-out — respira entre `scale(0.85)` y `scale(1.04)`. Glow más intenso (`rgba(244,78,28,0.22)`, blur 28px). Desactivado con `prefers-reduced-motion`.
- **Glow central hero**: `hero::before` reforzado — glow naranja central sube de 0.13 → 0.20, radio 17rem → 22rem.
- **Texto**: Removido `<p>Indicadores, academia y comunidad.</p>` (redundante con materiaLabel). H1 escalado: `clamp(1.45rem, 2.1vw, 2.6rem)`. `materiaLabel em` ahora visible (`display: flex`) — dot pulsante + "Materia viva".
- **Cards microinteracciones**: `:active { scale(0.97) }` para tap mobile. `:focus-visible` con outline naranja. Hover sin cambios.
- **Mobile 680px**: `.heroNavCard p { display: none }` — tarjetas compactas solo eyebrow + título. `min-height: 3.4rem`.
- NO se tocaron secciones fuera del `<section className={styles.hero}>` ni rutas funcionales.

### 🎨 Mejoras Estéticas Secciones Secundarias (2-8) — Gemini (2026-05-13)
- Se aplicó la identidad Materia a las secciones de Demos, Instalación, Tienda, Roadmap, Trading Lab, Comunidad y Analytics en `OfficialHome.tsx` y `official-home.module.css`.
- Se añadieron `kickerWrapper` y `kickerDot` (un punto naranja brillante) a los encabezados de sección.
- Se unificó el estilo de las tarjetas (`demoCard`, `installCard`, `storeCard`, `labCard`, `communityCard`, `metricCard`, `schemaItem`, `faqCard`) con fondo oscuro (`rgba(17, 22, 42, 0.58)`).
- Se implementó un efecto de resplandor (`cardGlow`) y un sutil `translateY(-4px)` al hacer hover.
- Se preservó intacto el Hero (sección 1) y las URLs de la tienda.
- `npm run lint` validado sin errores.

### 🔄 Sprint Actual — Ronda 4
**Regla:** Cada agente toca SOLO su zona. Leer esto ANTES de empezar.

| Agente | Panel | Tarea | Archivos que toca |
|---|---|---|---|
| 🔵 Claude (0.0) | Rediseño Home (Hub) | Reestructurar OfficialHome.tsx para que sea una pantalla inicial compacta (Hub) con navegación por tarjetas hacia las sub-secciones, eliminando el scroll vertical extenso. Integrar el nuevo `NavCard`. | `OfficialHome.tsx`, `official-home.module.css` |
| 🟢 Codex (0.1) | Checkout y Tienda | Separar el catálogo de productos y el checkout en sus propios componentes limpios, asegurando que el flow de compra (Gumroad/Stablecoins) esté modularizado. | `CheckoutPage.tsx`, `StorePage.tsx` (y sus CSS) |
| 🟡 Gemini (0.2) | Nuevos Componentes | ✅ FINALIZADO: Creado componente `NavCard` reutilizable y nueva página `/official/videos` (Hub de Videos) categorizada, siguiendo estética Materia. Incorporada barra de búsqueda por título y miniaturas estilo YouTube. Creada nueva página de Tienda (`/official/store`) leyendo catálogo real desde `gumroad-products.json` con diseño de tarjetas premium. Creada página de Documentación (`/official/docs`) con guía de instalación de 3 pasos y mockup de código Pine Script. Creada página de Comunidad (`/official/community`) con paneles para WhatsApp y YouTube. | `NavCard.tsx`, `NavCard.module.css`, `VideosPage.tsx`, `videos.module.css`, `videos/page.tsx`, `StorePage.tsx`, `store.module.css`, `store/page.tsx`, `DocsPage.tsx`, `docs.module.css`, `docs/page.tsx`, `CommunityPage.tsx`, `community.module.css`, `community/page.tsx` |

### 🔄 Sprint Actual — Ronda 3: Limpieza + Contenido Real
**Objetivo:** Eliminar TODO texto de instrucciones/dev visible al usuario. Reemplazar con contenido real de marketing/producto.

**Texto BASURA detectado que debe eliminarse o reescribirse:**
1. Sección "Base central" → habla de migraciones de tablas SQL (products, signals, trades, orders, licenses, learning_attempts). Un usuario NO debe ver esto. Reemplazar con algo tipo "Infraestructura" o "Tecnología" orientado al usuario.
2. Sección "Roadmap" → lista de tareas internas de dev. Convertir en roadmap de PRODUCTO para el usuario (qué va a poder hacer próximamente).
3. FAQs con notas técnicas de implementación → reescribir como preguntas reales de un trader.
4. Checkout → wallet addresses son PLACEHOLDER. Poner texto "Dirección se genera al confirmar" o similar.
5. Texto "Checkout propio local · Acceso por invitación TradingView · Stablecoins próximamente" → demasiado técnico.

| Agente | Panel | Tarea | Archivos |
|---|---|---|---|
| 🔵 Claude (0.0) | Reescribir textos del home | Limpiar roadmap, dataLayers, FAQs. Texto orientado al USUARIO/TRADER, no al dev. | `OfficialHome.tsx` (datos/arrays) |
| 🟢 Codex (0.1) | Limpiar checkout + subpáginas | Arreglar placeholders de wallet, mejorar UX del checkout, revisar academia/lab/backtesting por texto basura | `CheckoutPage.tsx`, subpáginas |
| 🟡 Gemini (0.2) | Ideas creativas + interactividad | Proponer y crear elementos interactivos nuevos para las subpáginas (animaciones, stats en vivo, testimonios) | Archivos nuevos si necesita |

### 🚨 CAMBIO DE DIRECCIÓN — Ronda 4: Hub de 1 Pantalla

**NUEVA VISIÓN:** La página principal `/official` debe ser CORTA. Máximo 1 pantalla (100vh). NO más scroll largo con muchas secciones.

**Concepto:** Un HUB tipo portal. Logo 3D Materia en el centro como fondo. Tarjetas de navegación flotando ALREDEDOR del logo (pueden solapar levemente los bordes del logo, no hay problema). Cada tarjeta lleva al usuario a su destino:
- Indicadores (tienda)
- Trading Lab / Práctica
- Backtesting
- Comunidad
- YouTube
- Checkout

**Lo que se ELIMINA del home:**
- Sección "Base central" / dataLayers (tablas SQL)
- Sección "Roadmap" técnico
- FAQs largas
- Textos descriptivos extensos
- Cualquier sección que agregue scroll innecesario

**Lo que se MANTIENE pero se mueve a subpáginas:**
- La info detallada de cada producto → va dentro de cada subpágina
- Los FAQs → pueden ir en /official/instalacion

**ASIGNACIÓN:**
| Agente | Tarea |
|---|---|
| 🔵 Claude (0.0) | REDISEÑAR OfficialHome.tsx como hub de 1 pantalla: logo centro + tarjetas alrededor. Eliminar secciones sobrantes. |
| 🟢 Codex (0.1) | Mover contenido eliminado a las subpáginas correspondientes si tiene valor. Seguir limpiando checkout. |
| 🟡 Gemini (0.2) | Terminar escenarios. Crear componente de tarjeta de navegación reutilizable con estética Materia. |

### ✅ Ronda 4 — Codex subpáginas/checkout (2026-05-13)
- `CheckoutPage.tsx`: todos los productos quedaron en `12.99 USD`.
- `CheckoutPage.tsx`: se quitaron direcciones wallet placeholder del UI; ahora muestra "La dirección de pago se genera al confirmar tu orden."
- `CheckoutPage.tsx`: textos visibles reescritos con tono profesional: acceso GONOVI, activación privada, métodos de pago claros y próximos pasos.
- `checkout.module.css`: agregado bloque de próximos pasos y estilo profesional para la tarjeta de dirección de pago.
- `AcademiaPage.tsx` + metadata de `/official/academia`: visible renombrado a "Trading Interactivo"; removidos "scoring local", "Nivel local" y "Reset score".
- `TradingLabPage.tsx` y `BacktestingPage.tsx`: revisados por textos visibles de dev/placeholder; sin cambios necesarios.
- Rutas verificadas: `/official/lab`, `/official/backtesting`, `/official/academia`, `/official/checkout`, `/official/instalacion`, `/official/analytics`.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.
- No se tocó `OfficialHome.tsx` ni CSS del logo.

### 🎯 Ronda 4: Hub de 1 Pantalla — Claude (2026-05-13)
- `OfficialHome.tsx` reescrito como HUB de 1 pantalla (`height: 100svh`, sin scroll en desktop).
- Eliminadas TODAS las secciones secundarias: demos, instalación, tienda, roadmap/dataLayers, labSection, communitySection, dashboardSection, footer.
- 6 tarjetas de navegación flotantes (3 izq + 3 der) alrededor del logo 3D:
  - Izquierda: Indicadores en vivo (→ algotrend.gonovi.app), Trading Lab (→ /official/lab), Backtesting Libre (→ /official/backtesting)
  - Derecha: Trading Interactivo (→ /official/academia), ▶ Videos y Tutoriales (→ /official/videos), Comunidad (→ youtube.com/@gonovi)
- Centro: h1 GONOVI ALGOTREND + "Obtener Acceso" (→ /official/checkout) + "Instalación" + live desks BTC 1H/Oro 15M/Oro 30M.
- `cameraDistance={2200}` confirmado en MateriaLogo.
- `official-home.module.css`: `.shell` → `height: 100svh`, `.hero` → `height: 100svh`. Breakpoint 1080px: shell + hero vuelven a `height: auto; min-height: 100svh` para tablet/mobile.
- `npm run lint`: OK. `npx tsc --noEmit`: OK.
- `/official/videos` creado por Gemini y verificado por Codex. Tarjeta del hub ya enlaza a esa ruta.

### ✅ Verificación Videos — Codex (2026-05-13)
- `/official/videos/page.tsx` existe y renderiza `VideosPage`.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.
- No se recreó ni pisó el trabajo de Gemini.

### ✅ Contador local de apariciones Trading Lab — Codex (2026-05-13)
- `TradingLabPage.tsx`: agregado tracking en `localStorage` con key `gonovi_scenario_counts`.
- Estructura guardada: `{ scenarioId: numVecesAparecido }`.
- El contador incrementa cuando se muestra un escenario: carga inicial, progreso restaurado, nueva ronda, reintento de errores y siguiente escenario.
- `/official/analytics`: agregada tabla "Apariciones Trading Lab" que lee la key local, cruza con `trading-lab-scenarios.ts`, muestra ID, título y apariciones, ordenado de mayor a menor.
- Nota técnica: al usar `localStorage`, la tabla muestra el conteo del navegador donde se abre el admin. Para conteo global de todos los visitantes habría que persistir eventos en Supabase.
- Smoke test local con Puppeteer en `http://localhost:3000/official/lab`: despues de limpiar storage, los totales subieron 1 → 2 → 3 al cargar y avanzar dos escenarios.
- Analytics revisado a nivel de implementacion; en el dev server activo no se pudo entrar al panel con los PIN disponibles en `.env.local`, por lo que la prueba visual del admin queda pendiente hasta correr el server con `ANALYTICS_PIN`/`DASHBOARD_PASSWORD` correcto.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Corrección modelo de venta: Pine Script completo — Codex (2026-05-13)
- `CheckoutPage.tsx`: eliminado el modelo de acceso TradingView/invitacion privada; ahora vende entrega del Pine Script completo por email.
- El campo TradingView queda como referencia opcional y ya no bloquea la compra.
- CTA principal cambiado a `Obtener Script Completo`.
- Agregado diferencial clave: `Script completo — tuyo para siempre, sin suscripcion ni acceso revocable.`
- `OfficialHome.tsx`: CTA del hub actualizado a `Obtener Script Completo` y nota central a `Codigo fuente Pine Script completo · entrega por email`.
- `/official/instalacion`: guia y FAQ reescritas para cargar el codigo en Pine Editor, no para activar invite-only.
- Metadata de checkout, home e instalacion actualizada al modelo de Pine Script completo.
- Barrido de textos antiguos: sin referencias visibles a invite-only, invitacion privada, licencia privada o acceso TradingView en paginas oficiales.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Checkout simulado por producto — Codex (2026-05-13)
- `CheckoutPage.tsx`: ahora lee el producto desde `?product=...` y usa `src/data/official/gumroad-products.json` como fuente de nombre, descripcion, features, categoria y precio.
- El checkout muestra resumen real del producto seleccionado; probado con `?product=fusion-x10`.
- Formulario actualizado: `Nombre` y `Email` son obligatorios; TradingView queda opcional.
- Boton principal cambiado a `Confirmar Pago`.
- Flujo de prueba: al confirmar muestra loader por 2 segundos y luego mensaje `Pago simulado con éxito. En breve recibirás el script de Pine Script en tu correo.`
- Guarda la orden simulada en `localStorage` con `status: simulated_success`, `productId`, `productName`, nombre y email.
- Smoke test Puppeteer OK: `/official/checkout?product=fusion-x10` carga Fusion X10, muestra features, procesa pago simulado y guarda orden local.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Dashboard cliente mock — Codex (2026-05-13)
- Creada ruta `/official/dashboard` en `src/app/official/dashboard/page.tsx`.
- Creado `src/components/official/dashboard/DashboardPage.tsx` con panel premium oscuro para biblioteca de scripts.
- Vista mock lista `IA AlgoTrend PRO` con botón `Descargar .txt`.
- El archivo descargado es un `.txt` demo generado con data URI; luego se reemplaza por el Pine Script real del comprador.
- Link de instrucciones apunta a `/official/docs`.
- Creada ruta `/official/docs` como alias/redirect hacia `/official/instalacion` para que el enlace no quede roto.
- `CheckoutPage.tsx`: al terminar el pago simulado, ahora aparece CTA `Ir a mi dashboard`.
- Smoke test local OK: `/official/dashboard` renderiza `IA AlgoTrend PRO`, `Descargar .txt` e `Instrucciones de instalación`; `/official/docs` redirige a `/official/instalacion`.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Topbar conectado — Codex (2026-05-13)
- `OfficialHome.tsx`: navegación superior convertida a `Link` de Next.js.
- Links finales: `Hub → /official`, `Tienda → /official/store`, `Videos → /official/videos`, `Dashboard → /official/dashboard`, `Instalación → /official/docs`.
- `official-home.module.css`: estilos de `.topnav` ajustados para links `<a>` manteniendo look original.
- Verificación HTTP local: `/official`, `/official/store`, `/official/videos`, `/official/dashboard` devuelven 200; `/official/docs` devuelve 307 hacia `/official/instalacion`.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Páginas legales — Codex (2026-05-13)
- Creada `/official/legal/terms` en `src/app/official/legal/terms/page.tsx`.
- Creada `/official/legal/privacy` en `src/app/official/legal/privacy/page.tsx`.
- Creado estilo compartido `src/app/official/legal/legal.module.css` con documento centrado, limpio y premium.
- Términos incluye cláusula exacta: `El código fuente Pine Script provisto es propiedad intelectual de GONOVI y su reventa está prohibida.`
- Política de privacidad cubre datos de checkout, soporte, analytics, localStorage/sessionStorage, terceros, conservación y derechos.
- Verificación HTTP local: ambas rutas devuelven 200 y renderizan contenido.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ✅ Sprint Pulido + Deploy Protection — Claude + Gemini (2026-05-16)

**Deploy protection:**
- `src/app/official/page.tsx`: guard `if (process.env.OFFICIAL_ENABLED !== 'true') notFound()` + `export const dynamic = 'force-dynamic'`. La ruta devuelve 404 limpio hasta que se setee la env var en Vercel.

**Branded 404:**
- `src/app/official/not-found.tsx`: página 404 estética GON — fondo marino, número 404 naranja, CTA "Volver al Hub". Server Component, CSS inline.

**Reloj NY en vivo:**
- `OfficialHome.tsx`: `useEffect` con `Intl.DateTimeFormat` timezone `America/New_York`, refresca cada 10s. Reemplaza el "09:42" hardcodeado.

**BTC en vivo:**
- `OfficialHome.tsx`: fetch a Bitstamp `/api/v2/ticker/btcusd/` cada 30s. Ticker muestra cambio % real en verde/rojo. Fallback `···` mientras carga.

**Ticker animado:**
- Bottombar: ticker scrolling infinito con CSS `@keyframes tickerScroll`. 8 pares incluyendo GC1!, CL1!, DXY. Hover pausa la animación. Fade con `mask-image` en los bordes.

**Click tracking en hub cards:**
- `HubCard`: `onClick` fire-and-forget → `POST /api/analytics/track` con `event_type: hub_card_click`, `card_id`, `card_title`.
- `src/app/api/analytics/track/route.ts`: extendido para soportar `event_type` != pageview → llama a `logEvent()`.
- `src/lib/analytics.ts`: nueva función `getCardClickStats()` — agrupa clicks de `algotrend_events` por tarjeta, últimos 30 días.

**Panel analytics con card clicks:**
- `AnalyticsDashboard`: nueva sección "Clicks por tarjeta del Hub" visible cuando hay datos.
- `src/app/official/analytics/page.tsx`: llama a `getCardClickStats()` en paralelo con las otras queries.

**Modal de confirmación de compra:**
- `src/components/official/checkout/OrderConfirmModal.tsx`: overlay glassmorphism con ✓ naranja, email del comprador, nombre del producto, CTA "Ir a mi Dashboard".
- `CheckoutPage.tsx`: reemplaza el mensaje inline por el modal. Se cierra con click fuera o botón "Cerrar".

- `npx tsc --noEmit`: OK (verificado en todos los pasos).

### ✅ Auditoría y cierre de páginas sueltas — Codex (2026-05-14)
- Auditoría rápida `/official`: páginas con lógica real: `lab`, `backtesting`, `academia`, `checkout`, `store`, `instalacion`, `analytics`, `live/btc-1h`.
- Huecos detectados: `videos` tenía links `#`, `/official/docs` redirigía aunque existía `DocsPage`, `store` conservaba copy viejo de invitación/acceso, `community` tenía link WhatsApp placeholder, `dashboard` no leía compras reales del checkout.
- `/official/docs`: ahora renderiza `DocsPage` con metadata propia; ya no redirige a instalación.
- `/official/videos`: eliminados links `#`; cada tarjeta abre búsqueda en el canal YouTube de GONOVI con el título del video.
- `/official/store`: copy actualizado al modelo correcto de Pine Script completo por email, sin suscripción ni acceso revocable.
- `/official/community`: WhatsApp placeholder reemplazado por canal oficial `wa.me/message/JLQM6YKXFPKHP1`.
- `/official/dashboard`: ahora lee `gonovi:checkout:orders:v1` desde `localStorage` con `useSyncExternalStore`; si existe orden simulada del checkout, lista el producto comprado y genera descarga `.txt`; mantiene fallback de biblioteca de muestra si no hay compras.
- Smoke test dashboard: inyectada orden `fusion-x10` en `localStorage`, `/official/dashboard` muestra Fusion X10, descarga `.txt` e instrucciones.
- Añadidos botones de "Volver a GONOVI" en las páginas nuevas (`Store`, `Docs`, `Community`, `Videos`) con enlace a `/official` y estilo consistente (`backLink`).
- Verificación HTTP local: `/official`, `/official/store`, `/official/videos`, `/official/dashboard`, `/official/docs`, `/official/community`, `/official/lab`, `/official/backtesting`, `/official/academia` devuelven 200.
- `npm run lint`: OK.
- `npx tsc --noEmit`: OK.

### ⚡ CRITICAL FIX: Analytics CPU Limit — Gemini (2026-05-14)
- Creado `src/lib/client-analytics.ts` con lógica de agrupación (batching en arrays, flush cada 15s) y `navigator.sendBeacon`.
- Múltiples componentes (`OfficialHome.tsx`, `SponsorBanner.tsx`, `ShareButton.tsx`, `Dashboard.tsx`) migrados para usar el helper `track()` optimizado en lugar de invocaciones directas a `fetch()`.
- Rutas de API en `/api/analytics/track/route.ts` y `/api/analytics/event/route.ts` adaptadas para recibir e iterar sobre arrays de eventos, reduciendo radicalmente los picos de CPU (Lambdas) en Vercel.

### 🧭 Contexto de marca persistente — GONOVI (2026-05-18)
- `gonovi.app` es la landing principal de la marca personal GONOVI y del canal de YouTube de Gonzalo.
- AlgoTrend es solo uno de varios indicadores/productos dentro del ecosistema GONOVI.
- `fusion-engine-live` fue el nombre inicial del proyecto/repositorio; no es la marca pública.
- No diseñar ni escribir `gonovi.app` como dashboard de AlgoTrend. Tratarlo como hub premium/personal de GONOVI.
- El cartel de Próximamente puede enlazar temporalmente a una app live específica, pero el lenguaje principal debe ser GONOVI, no AlgoTrend como marca madre.

### 🔐 Fase 2: UI Auth & Account — Gemini
- **Ruta `/auth`**: Creada con `page.tsx` protegido por el flag `OFFICIAL_ENABLED`. Renderiza el componente `AuthForm`.
- **Componente `AuthForm.tsx`**: Implementado flujo OTP en dos pasos (email y código de 6 dígitos). Incluye honeypot (`_hp`), validaciones Regex cliente y límites de caracteres en los inputs para seguridad.
- **Ruta `/account`**: Creada. Espera la infra de servidor (`createServerClient` de `@/lib/supabase/server`). Contiene mock fallback en desarrollo si la API falla o aún no está terminada por Codex.
- **Componente `AccountPanel.tsx`**: Panel modular con la estética Materia (blur, glassmorphism), renderizando un avatar, info del usuario y 4 tarjetas interactivas (Compras, Progreso, Alertas, Soporte).
- **Verificación Visual y Código**: Se tomaron capturas con Playwright en mobile y desktop. Linter (`npm run lint`) y Typecheck (`npx tsc --noEmit`) sin errores. Implementados estilos CSS encapsulados en módulos dedicados.

### 🛠️ Fase 4: Soporte conectado a cuenta — Gemini + Claude (2026-05-22) — ✅ RESUELTA

**Solución aplicada: Opción B (tabla nueva limpia).**
- Migration `supabase/migrations/003_gonovi_support_tickets.sql` aplicada via `supabase db push --linked`.
- Schema: `id, user_id (nullable), email, subject, message, status, created_at` + 2 índices + 3 RLS policies (select_own, insert_own, service_role_all) + grants.
- `route.ts` y `account/page.tsx` apuntan a `public.gonovi_support_tickets`.
- Smoke test confirmado: POST anónimo → fila persistida (`id=435212e2-...`, `user_id=null`). Email Resend sigue funcionando.
- Cero impacto sobre `support_tickets` compartida con Dolcato.

**Próximo paso pendiente:** commit + push (esperando OK explícito).

---

### 🎲 Monte Carlo Auditor — Claude (2026-05-22) — ⏸️ ESPERANDO OK PARA REMOTE/PUSH

**Estado código (working tree, sin commit):**
- `supabase/migrations/004_montecarlo_simulations.sql` — schema `simulaciones_montecarlo` (user_id, métricas, veredicto) + RLS (insert/select propios). NO aplicada al remote todavía.
- Deps npm: `lucide-react`, `apexcharts`, `react-apexcharts` instaladas (modifica `package.json` y `package-lock.json`).
- `src/components/official/montecarlo/MonteCarloAuditor.tsx` — TS, `'use client'`, `dynamic('react-apexcharts', { ssr: false })`, `createClient` de `@/lib/supabase/client`. Reglas extra de blindaje: maxLength 100 en input, slice defensivo antes de insertar, límite 5 MB en CSV.
- `src/app/official/montecarlo/page.tsx` — metadata SEO + render del componente.
- `src/components/official/OfficialHome.tsx` — agregada card #07 (`Auditor / Monte Carlo`, side right, href `/official/montecarlo`).

**Validaciones que pasaron:**
- `npx tsc --noEmit` ✅
- `npx eslint` sobre archivos nuevos ✅
- `npm run build` ✅ — ruta `/official/montecarlo` aparece en el output.

**Próximos pasos pendientes (esperando OK):**
1. `supabase db push --linked` para aplicar migration 004 al remote.
2. Smoke local: abrir `localhost:3000/official/montecarlo`, subir un CSV de prueba, verificar render + insert si hay sesión.
3. Commit + push a `feat/public-delayed-btc-1h` + `main` (refspec) para deploy.

---

### 🛠️ Fase 4 (histórico, antes del fix): EN CURSO

**Estado código (aplicado, sin commit todavía):**
- `src/app/api/support/route.ts` — Zod schema, honeypot, `runtime='nodejs'` + `dynamic='force-dynamic'`, lectura de sesión vía `@/lib/supabase/server`, intento de INSERT en `support_tickets`, envío Resend después del insert. **Falta trailing newline.**
- `src/components/official/soporte/SoportePage.tsx` — useEffect monta `createClient` (browser), `getUser()`, pre-fill de `email` si vacío. Cero cambios visuales.
- `src/app/account/page.tsx` — query count `from('support_tickets').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status','open')`, pasa `supportTicketsCount` como prop.
- `src/components/auth/AccountPanel.tsx` — nueva prop `supportTicketsCount: number`, ternario para texto de la card "Mi soporte".

**Bug bloqueante: schema drift en `support_tickets`**
- La tabla NO es exclusiva de GONOVI: es shared multi-tenant con otro proyecto (Dolcato).
- Columnas NOT NULL que migrate 002 local NO refleja: `tenant_id`, `code`, `customer`, `phone`, `issue_type`, `category`, `category_label`, `customer_name`, `customer_phone`.
- Resultado: smoke `curl POST /api/support` devuelve `{"ok":true}` (try/catch traga el error), pero **no se inserta fila**. Email Resend SÍ se manda.
- Migración local `supabase/migrations/002_support_tickets.sql` está desfasada del remote real.

**3 opciones presentadas al usuario (pendiente decisión):**
- **A — Parche rápido:** route.ts agrega `tenant_id: 'gonovi'`, genera `code = 'GON-SUP-' + crypto.randomUUID().slice(0,8)`, mapea `name → customer/customer_name`. Comparte tabla con Dolcato.
- **B (RECOMENDADO) — Tabla nueva limpia:** crear migration `003_gonovi_support_tickets.sql` con schema propio + RLS propias, route.ts pasa a usar `gonovi_support_tickets`. Aislamiento total para crecer (analytics, exports, GDPR).
- **C — Sin DB:** quitar el INSERT, solo Resend. Vuelve al estado pre-Fase-4 en cuanto a persistencia; el conteo en `/account` queda en 0 siempre.

**Validaciones que SÍ pasaron:**
- 8 smokes de Gemini OK (incluido check del muro de mantenimiento intacto).
- Lista negra (proxy.ts, ComingSoonPage, etc.) intacta — zero scope creep.
- Build/lint/typecheck OK.

**Próximos pasos (cuando user decida A/B/C):**
1. Aplicar fix correspondiente.
2. Smoke real: insertar via curl + verificar fila en DB.
3. Commit + push a `feat/public-delayed-btc-1h` y a `main` (refspec).
4. Verificar deploy producción.
5. Pasar a Fase 8 (Codex — blindaje XSS/inyección final).
