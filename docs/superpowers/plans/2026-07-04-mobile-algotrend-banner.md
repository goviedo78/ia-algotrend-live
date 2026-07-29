# Mobile IA AlgoTrend Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a readable mobile-only IA AlgoTrend promotion while preserving the existing desktop banner exactly in BTC 1H and Oro 30M.

**Architecture:** Keep one `SponsorBanner` component per app. Render a dedicated `sm:hidden` mobile composition and retain the current desktop composition behind `hidden sm:flex`; both variants share the same link and analytics handlers.

**Tech Stack:** React 19, Next.js 16 `Image`, Tailwind CSS 4, Node test runner, Vercel.

---

### Task 1: Lock responsive behavior with a regression test

**Files:**
- Create: `tests/mobile-banner.test.mjs`

- [x] Add a Node test that reads `src/components/SponsorBanner.tsx` and requires `sm:hidden`, `hidden ... sm:flex`, `IA ALGOTREND`, `SMART AI TREND DETECTION`, and the existing Gumroad URL.
- [x] Run `node --test tests/mobile-banner.test.mjs` and confirm it fails because the mobile composition does not exist.

### Task 2: Implement the mobile composition

**Files:**
- Modify: `src/components/SponsorBanner.tsx`
- Modify: `../gold-30m-live/src/components/SponsorBanner.tsx`

- [x] Add a `112px` mobile-only card with a subdued artwork background, HTML title/subtitle, robot mark, and visible CTA.
- [x] Wrap the unchanged desktop structure with `hidden sm:flex`.
- [x] Copy the exact component implementation to Oro 30M and verify both files are byte-identical.
- [x] Run `node --test tests/mobile-banner.test.mjs`, `npm run typecheck`, and `npm run build` in BTC 1H; run `npx tsc --noEmit` in Oro 30M.

### Task 3: Visual QA and production deployment

**Files:**
- No additional source files.

- [x] Render BTC 1H at 390px, 430px, and desktop width; confirm no horizontal overflow and no desktop visual change.
- [x] Deploy BTC 1H with `npm run deploy:prod` and Oro 30M with `vercel deploy --prod --yes`.
- [x] Verify production aliases, banner text, image asset, and public home behavior.
