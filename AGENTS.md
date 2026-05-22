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
