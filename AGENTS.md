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
