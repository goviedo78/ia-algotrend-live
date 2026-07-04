# Mobile IA AlgoTrend Banner Design

## Goal

Make the IA AlgoTrend promotion readable and visually strong on narrow mobile screens while preserving the existing desktop banner exactly.

## Scope

- Apply the same responsive banner component to BTC 1H and Oro 30M.
- Do not alter the desktop (`sm` and wider) banner markup, dimensions, artwork, or layout.
- Do not change trading logic, operations, alerts, APIs, or the maintenance wall.

## Mobile design

- Breakpoint: below Tailwind `sm` (`640px`).
- Height: `112px` so the content is legible without dominating the dashboard.
- Use the existing IA AlgoTrend artwork as a subdued technological background.
- Render the important copy as HTML rather than shrinking text embedded in the wide image:
  - `IA ALGOTREND`
  - `SMART AI TREND DETECTION`
  - `Indicador COMPLETO` CTA
- Omit the four small feature labels on mobile because they are unreadable at this width.
- Preserve the existing Gumroad destination, accessibility label, impression tracking, and click tracking.

## Responsive behavior

- Mobile receives the compact composition only.
- Desktop continues rendering the current banner without visual changes.
- The banner must not introduce horizontal overflow at 390px or 430px widths.

## Validation

- TypeScript and production build must pass.
- Compare desktop before/after to confirm no visual change.
- Test mobile at 390px and 430px.
- Confirm the image loads, CTA is visible, Gumroad link remains correct, and no relevant console errors appear.
- Deploy only after verifying the requested UI and ensuring existing unrelated work is not accidentally regressed.
