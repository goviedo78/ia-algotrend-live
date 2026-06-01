# iOS Safari WebGL Logo Jump

## Context

The GONOVI mobile hub uses `MateriaLogo`, a React Three Fiber/WebGL 3D logo, behind the vertical card carousel. On iOS Safari, aggressive vertical swipes could make the logo appear to jump or resize for a frame.

The visual logo, material, heat, bloom, preset, and motion effects are intentionally part of the brand and should not be removed to solve this.

## Symptom

- Reproduces mostly on iOS Safari.
- Happens during violent swipe/momentum scroll on the vertical cards.
- Looks like the 3D logo changes size or reloads briefly.
- More visible when the active card changes or the browser chrome hides/shows.

## Root Cause

There were multiple overlapping Safari-sensitive triggers:

1. The logo wrapper used viewport units (`100vw`, `100svh`, `-30vw`) while iOS Safari browser chrome can change viewport metrics during scroll.
2. The wrapper transform was being updated during scroll, which can interact badly with a fixed WebGL canvas.
3. `MateriaLogo` calculated camera rest position from React Three Fiber `size.width / size.height`.
4. When iOS Safari reported small canvas/viewport size changes, `CameraEntry` recalculated `restPos` and copied it into `camera.position`, which looked like a size jump.
5. A mobile-only `::after` overlay on the logo wrapper created a rectangular moving veil, making the WebGL container boundary visible as a light stripe.

## Fix Pattern

Do not alter the logo graphics. Stabilize the container and camera math instead.

Implemented fixes:

- Lock mobile logo wrapper dimensions once using CSS vars:
  - `--gonovi-mobile-logo-width`
  - `--gonovi-mobile-logo-height`
  - `--gonovi-logo-base-x`
- Use `height="100%"` when rendering `MateriaLogo` inside `MateriaLoadingScreen`, instead of allowing the component default `100vh`.
- Add `lockResponsiveSize` to `MateriaLogo` so `CameraEntry` can freeze the R3F size used for camera distance calculation on mobile.
- Move the logo wrapper by active carousel zone (`top`, `middle`, `bottom`) instead of by every scroll pixel.
- Debounce logo wrapper movement until scroll momentum settles.
- Remove the mobile wrapper `::after` veil that exposed the canvas box boundary.

## Files Involved

- `src/components/brand/MateriaLogo.tsx`
- `src/components/ui/MateriaLoadingScreen.tsx`
- `src/components/ui/MateriaLoadingScreen.module.css`
- `src/components/official/OfficialHome.tsx`

## Do Not Regress

- Do not disable `MateriaLogo` on mobile.
- Do not replace the 3D logo with a static image unless explicitly requested.
- Do not remove `cursorTilt`, `globalPointerHeat`, `autoRotateIdle`, or brand material/preset behavior to solve performance.
- Do not reintroduce scroll-pixel-based logo transform updates on iOS mobile.
- Do not make `CameraEntry` recalculate camera position from changing mobile viewport size during scroll.
- Do not add a moving rectangular overlay/mask inside the logo wrapper.

## Verification

Minimum local checks:

```bash
npm run typecheck
npm run lint
```

Manual device check:

1. Open `https://gonovi.app/?dev=materia` or local equivalent in iOS Safari.
2. Swipe the vertical card carousel hard up/down.
3. Confirm the logo stays alive but does not resize/jump.
4. Confirm no light rectangular stripe moves with the logo.

