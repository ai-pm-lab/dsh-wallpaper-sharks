# ascii-sharks attribution

This plugin vendors the rendering/simulation engine of **ascii-sharks**:

- Project: https://github.com/stackedlol/ascii-sharks
- Author: stackedlol
- License: MIT

Vendored files live under `vendor/`:

- `engine.ts` — canvas wiring / fixed-timestep loop
- `world.ts` — fish-school + shark artificial-life simulation
- `renderer.ts` — ASCII grid renderer
- `species.ts` — fish species parameters
- `math.ts` — math helpers + divergence-free ocean current
- `index.ts` — barrel export

Original work in this repository is the DSH plugin wrapper:

- `src/client.tsx` — background layer mount + settings section
- `src/store.ts` — persisted configuration (localStorage)
- `lib/index.js` — no-op host half
- `scripts/build.mjs` — esbuild bundle into the DSH client-plugin envelope

## Changes made to the vendored engine

The vendored files are not byte-identical to upstream; they were adapted for
full-screen wallpaper use and still carry the upstream MIT license:

- `renderer.ts`: added `OceanTheme` (`isDark`, `backdrop`, `grid`, `fish`,
  `accent`, `wake`, `strength`), `PAPER_THEME` / `INK_THEME`, `setTheme`,
  `setCellWidth`; transparent 2D context; fixed `cw = 8`; dual-ink shark
  palette (`isDark`), fish alpha floor 0.36, max 0.95.
- `engine.ts`: added `pause` / `setOpacity` / `setPointerEnabled` /
  `setTheme` / `setCellWidth` / `setFps` / `setMaxDpr` / `setSharkScale`;
  frame-rate throttle; `visibilitychange` pause.
- `world.ts`: added shark `startle` state (click scares sharks) and a global
  `sizeScale` (`setSizeScale`) so the wallpaper can resize sharks in place.

See the upstream MIT license text:
https://github.com/stackedlol/ascii-sharks/blob/main/LICENSE
