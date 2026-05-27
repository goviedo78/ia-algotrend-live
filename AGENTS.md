<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## GONOVI Multi-Agent Panels

Claude and Gemini are connected to visible tmux panes for this project. When delegation or cross-checking is useful, send instructions directly to those panes so the user can supervise the live coordination.

- Claude: `tmux send-keys -t GONOVI_LANDING:0.0 "message" C-m`
- Gemini: `tmux send-keys -t GONOVI_LANDING:0.2 "message" C-m`
- Do not use hidden/background delegation for these agents unless the user explicitly changes this rule.
- Always include the final `C-m` / Enter when sending pane messages; otherwise the message is only typed and the agent will not start.

## GONOVI Brand Boundary

GONOVI is Gonzalo Oviedo's personal brand and YouTube/channel ecosystem. `gonovi.app` is the personal landing/hub for the GONOVI brand. AlgoTrend is only one product/indicator inside that ecosystem, not the parent brand. Do not label GONOVI pages as AlgoTrend, do not turn `gonovi.app` into the BTC 1H dashboard, and do not use "Fusion Engine Live" as public brand language; it is only the historical project/repo name. Live product subdomains such as `algotrend.gonovi.app`, `oro15.gonovi.app`, and `oro300.gonovi.app` are separate product apps.

## GONOVI Maintenance & Architecture Strict Rules (CRITICAL)

1. **AlgoTrend BTC 1H is a DEMO**: It is merely a demo of the indicator. It will NEVER be the main page.
2. **gonovi.app is the MAIN LANDING**: This is the primary site that will contain all necessary elements, including the AlgoTrend demo.
3. **MAINTENANCE WALL IS ACTIVE**: The site is currently behind a "Próximamente" (Coming Soon) screen. **DO NOT REMOVE** the "Próximamente" screen until the user EXPLICITLY orders you to do so.
4. **Bypass URL**: The active testing route where the main page is actually functioning is the bypass URL: `/?dev=materia`.
5. **ABSOLUTE MANDATE**: These rules CAN NEVER BE OMITTED. NEVER point `gonovi.app` to another project. JAMÁS deben quitar el cartel de Próximamente hasta recibir la orden explícita.

## GONOVI Deploy Protocol (CRITICAL)

- A plain `git push` from any branch other than the production branch creates a Vercel **preview**, not the live site.
- Do not tell the user that a change is "live" unless the output explicitly says `target production` and `Aliased: https://gonovi.app`.
- To publish a validated change to the public production aliases, run exactly:
  `npm run deploy:prod`
- For review-only work, use:
  `npm run deploy:preview`
- After any production deploy, verify `https://gonovi.app` still returns the Próximamente page unless Gonzalo explicitly ordered removing the wall.
- Never change `proxy.ts`, `OFFICIAL_ENABLED`, `BYPASS_TOKEN`, or the maintenance wall as part of a deploy fix.

## GONOVI Supabase Schema Rules (CRITICAL)

Background: la migración `009_explicit_grants_supabase_v2.sql` aplica GRANTs explícitos a `anon`/`authenticated`/`service_role` para cumplir el breaking change de Supabase (oct 2026). La migración `010_default_privileges_least_privilege.sql` restringe los DEFAULT PRIVILEGES de tablas futuras (anon = solo SELECT). La defensa real de los datos es **RLS (Row Level Security)**.

Reglas inviolables al crear cualquier tabla nueva en `public` schema (migraciones `supabase/migrations/*.sql`):

1. **TODA tabla nueva DEBE incluir `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;`** en la misma migración que la crea. Sin excepciones.
2. **Si la tabla NO debe ser accesible por roles públicos** (anon/authenticated), no agregues policies. Habilitar RLS sin policies = deny-all (solo `service_role` accede vía bypass).
3. **Si la tabla SÍ debe exponerse a anon o authenticated** (ej. tabla pública o por-usuario), creá las `CREATE POLICY` correspondientes en la misma migración, nunca después.
4. **Funciones (`CREATE FUNCTION`) que hagan operaciones privilegiadas** deben usar `SECURITY DEFINER` y validar el rol del caller adentro. El default privilege para `routines` ya está restringido a `authenticated EXECUTE` + `service_role ALL`.
5. **Antes de aplicar la migración al remoto (`npx supabase db push`)**, revisar que cada `CREATE TABLE` tenga su correspondiente `ENABLE ROW LEVEL SECURITY` en el archivo. Es un checklist mental obligatorio.

Razón: si una tabla nueva queda sin RLS, `anon` (el rol público con la `anon_key` que va en el frontend) puede al menos leer (`SELECT`) por los default_privileges. Y si alguien olvida también revisar la migración 010 en el futuro, podría exponerse total. RLS es la primera línea de defensa, no la última.

