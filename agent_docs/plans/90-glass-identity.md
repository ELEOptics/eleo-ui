# Plan #90: Glass identity in layout2D, and phos on layout2D

Status: approved 2026-10-06
Branch: `plan/90-glass-identity` PR: #111 Depends on: plan #30 (done) Roadmap: `agent_docs/roadmap.md`, row C

## Problem

`layout2D` knows two glasses, crown and flint. A real design reuses and pairs glasses, and the drawing can't
show which elements share one. phos draws its 2D layout with its own `src/lib/render/render2d.ts`, a second
renderer with its own look. Row C gives each glass its own fill and a legend, then moves phos onto
`layout2D` so phos can delete that file. It also absorbs the recorded-data hardening that plan #30 deferred.

## Ground truth

- `layout2d.js:55` fills a lens with `var(--glass-flint)` when `glass === "flint"` and `var(--glass-crown)`
  otherwise, so any other string draws as crown (#60). `index.d.ts:16` types `glass` as `"crown" | "flint" | null`.

- Tokens (`packages/tokens/src/tokens.json:156-170`): `glass-crown` is #c5d7ea light / #2e4a68 dark, `glass-flint` is
  #a6bfd9 / #243c57. They are ΔE2000 6.7 apart in light and 4.7 in dark (measured with culori, 2026-10-06).

- Feasibility, measured with culori (farthest-point search, 8 fills, both themes):

  | Fill space (oklch) | Best min ΔE2000, light / dark |
  | -- | -- |
  | Inside the crown–flint token span | 3.4 / 3.7 |
  | L .66–.93 light, .26–.52 dark; hue 225–275; chroma ≤ .10 | 12.5 / 12.6 |

  The C / U12 kill criterion fired before approval. The user chose to widen the band (Change log).

- `legend(kind, n)` (`renderers.js:208`) draws field, wavelength, T/S and ray-role keys. It has no glass key.
  `Legend.svelte` wraps it, and `Layout2D.svelte` passes its props to `layout2D`.

- The standalone entry `dist/eleo-layout.js` (`iife-layout.js`) carries `layout2D` and `layoutBounds`. The roadmap
  allows it 2 kB gzipped of growth per row, but no size test exists yet.

- Classic build: `iife.js` copies the API into `window.ELEO` before `useSample` sets `sample`, so
  `window.ELEO.sample` stays null (#47). The gallery pins `ZIMG` because of it (`gallery/index.html:73`).

- Gallery: `meritTile` calls `layout2D` inside `draw()`, so a merit fixture that `layout2D` rejects blanks every tile (#76).

- Validation gaps (plan #30, deferred): a non-finite ray point gets blamed on the box (#74), and a surface with no
  `profile` throws a bare TypeError (#75).

- phos (ELEOptics/phos, no agent workflow, no test runner, Node ≥ 22 via Vite): `src/lib/render/render2d.ts`
  turns phos-core's `VisualizeSystem2dResponse` into SVG paths, with `html.ts` doing the markup. It is used by
  `Design.svelte`, `BrickDiagram.svelte` and `state/opticalModel.svelte.ts`. That response (aurora
  `ts_bindings/VisualizeSystem2dResponse.ts`) holds elements → interfaces (`interface_type`: Optical,
  Fictional, Detector, Aperture; `points`) and per-source rays (intercepts x, y, wavelength, status). It holds **no
  glass**. phos's own model has `surface.material` with an Abbe number (`BrickDiagram.svelte:203,741`).
  phos depends on `@eleo/aurora-types` (`file:../aurora`) and not yet on `@eleoptics/*`.

- Tests: unit tests run under `node --test` against `src/*.js`. Playwright drives the gallery
  (`tests/gallery.spec.js`), which can read computed styles in both themes.

- Prior art: culori (already a dev dependency) for ΔE2000 in tests. At runtime, CSS `color-mix(in oklch, …)` and
  relative color syntax resolve fills from tokens in the browser, so a theme switch needs no redraw and no
  runtime color library ships.

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | U12's fills. Each glass `{name, nd, vd}` in a layout gets its own fill inside the glass-blue band: L .66–.93 light / .26–.52 dark, hue 225–275, chroma ≤ .10 (user, 2026-10-06). The band ends are tokens. Lower vd moves toward flint, nd shifts lightness, within one drawing the same name gets the same fill, and a fill too close to an earlier one is nudged apart (so a glass's fill can differ between designs with different glass sets). `"crown"` and `"flint"` still draw exactly `var(--glass-crown)` and `var(--glass-flint)`. | Given 200 seeded designs of 2 to 8 distinct glasses from `tests/fixtures/glasses.json`, when the gallery page draws each with `layout2D` in light and in dark, then the computed fills are pairwise ΔE2000 ≥ 8 in each theme, the same name gives the same fill within each design, and at equal nd a lower vd never gives a lighter fill. The five website fixtures still draw only the two token fills. | `property: over designs of up to 8 distinct glasses drawn from a committed table of public catalog values (name, nd, vd), pairwise ΔE2000 ≥ 8 between fills in both themes (culori); the same name gives the same fill; at equal nd, a lower vd never gives a lighter fill` (roadmap U12) | `tests/glass-fills.spec.js::glass fills are distinct, stable and ordered` |
| O2 | U12's legend. `glassLegend(layout)` lists each distinct glass once, by name, in order of first use, with a swatch in its drawn fill. It ships in `@eleoptics/plots`, the standalone entry, and `Legend.svelte` (`kind="glass"`). | Given the Cooke-glasses fixture, when the gallery draws its tile, then the legend shows one swatch per distinct glass in first-use order, and each swatch's computed fill equals its lenses' polygon fill, in both themes. | `property: legend swatch fills equal the polygon fills of the same glass; names once each, in first-use order` (part of roadmap U12) | `tests/glass-fills.spec.js::glass legend matches the drawing` |
| O3 | Bad recorded data fails with a named error. A non-finite ray point is named at its index (#74). A non-image surface with no profile is named (#75). A glass string other than `crown` or `flint` throws (#60). A merit fixture `layout2D` rejects blanks only its tile (#76). The classic build exposes `window.ELEO.sample`, and the gallery reads `zimg` from it (#47). | Given each bad input, when `layoutBounds` or `layout2D` runs, then it throws its named message. Given the classic build, when the sample script loads, then `window.ELEO.sample.zimg` equals `sample.json`'s. | `spec: the named-error family of plan #30 (#65, #67): "<fn>: <path> <what is wrong>"; fixture sample.json zimg` | `tests/unit/layout2d.test.js::layoutBounds names a bad input`, `tests/gallery.spec.js::classic build exposes the sample` |
| O4 | phos draws its 2D layout with `@eleoptics/plots-svelte`'s `Layout2D`, from an adapter in phos that turns `VisualizeSystem2dResponse` plus phos's materials into the recorded format. It deletes `render2d.ts` and `html.ts` (one PR on ELEOptics/phos, which the user merges after the release, user 2026-10-06). | Given a `VisualizeSystem2dResponse` captured from phos-core for the sample achromat, when the adapter runs, then every Optical, Aperture and Detector interface point and every ray intercept of a non-fictional interface appears in the recorded layout within 0.01 mm, and `layout2D` draws it without throwing. | `fixture: VisualizeSystem2dResponse for the sample achromat captured from phos-core (public lens); property: adapter round trip within 0.01 mm` | `phos: src/lib/render/layout.test.ts::adapter keeps every point` |

## Non-goals

- Resolving bare catalog names (`glass: "N-BK7"`) from a table at runtime. The caller passes `{name, nd, vd}`, and
  the table is test-only. Shipping it would cost the 2 kB budget. Next plan if a consumer asks.
- Per-glass fills in `layout3D`: row J.
- Field-label spacing (#70): deferred by the roadmap. No layout we draw hits it.
- Changing `release.yml`'s explicit token (#86): deferred. The user kept it in CR #79.
- Recording phos-core fixtures with `scripts/record-phos-core.py`: row D. O4 uses one captured response in phos.
- A test runner or CI in phos: its single test runs on `node --test` (type stripping), with no new dependency.
- Publishing the release: merging the Version Packages PR stays the user's (roadmap Constraints).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| #60 | absorb | M3, reuse: an unknown glass string throws |
| #74 | absorb | M3, reuse: a finite-point guard in `layoutBounds` |
| #75 | absorb | M3, with #74 (same validation loop): surface without profile |
| #76 | absorb | M3, reuse: `meritTile` catches |
| #47 | absorb | M3, reuse: classic build's `ELEO.sample` |
| #70 | related | deferred (roadmap 2026-10-06): no layout hits it |
| #86 | related | deferred (roadmap 2026-10-06): kept by the user in CR #79 |

## Constraints and assumptions

- From the roadmap: every gallery tile keeps working. The standalone layout entry grows at most 2 kB gzipped,
  checked by a size test (M1 adds it). The typed API is added alongside the old one, so `"crown"` and `"flint"` stay.
  The release ships when a consumer pulls, and phos pulls at the end of this row.
- Browsers: relative color syntax and `color-mix(in oklch)` (Chrome 119, Safari 16.4, Firefox 128). Tauri's
  WebView on macOS is Safari ≥ 16.4. Playwright's Chromium supports both.
- Two new color tokens hold the band ends (light and dark values), as the design system's named contract. A tokens
  minor would fall outside the `@eleoptics/tokens: ^0.1.0` peer of both plots (`packages/plots/package.json:62`) and
  plots-svelte, and `changeset version` rewrites them to `^0.2.0` (checked by the critic in a temp workspace). So the
  release item widens both to `>=0.1.0 <1` (the #21 lesson). That is a manifest change, so the plan PR is a security trigger for
  `merge.sh` and the user merges it.
- Assumption: phos can produce a `VisualizeSystem2dResponse` for the sample achromat from a local phos-core.
  If not, O4's fixture becomes a CR.
- phos's Design view knows each interface's material only as a `MaterialId` (aurora `Interface.ts`: name, vendor;
  `opticalModel.svelte.ts:118`). nd and vd live in phos-core's `Material.optical` (`Optical.ts`: `nd`, `vd`,
  nullable). M4 opens with a timeboxed spike: can phos fetch `Material.optical` per id? If not, a CR before the adapter.
- M4 runs in ELEOptics/phos, which has no `check.sh`, hooks or agent workflow. The orchestrator commits there on
  branch `eleo-ui-c/layout2d`, one commit per item citing the eleo-ui issue. Done there means `npm run check` and
  `node --test src/lib/render/*.test.ts` pass. The PR is opened from that branch.
- The size test and the release item serve the roadmap's Constraints (the 2 kB budget, release on consumer pull),
  not an outcome.

## Decisions

- No ADR. The styling rule and boundary ADR is row D's. This plan follows U5's rule ahead of it: options carry
  data (`{name, nd, vd}`), never a color, and CSS custom properties are the one override.
- Core change, approved with this plan (user, 2026-10-06): `CLAUDE.md` Core lists
  `packages/plots/src/index.d.ts` and the `exports` of each `packages/*/package.json` (plan #30's proposal).

## Milestones

### M1: Glass fills on one tile GitHub: `P90 M1: Glass fills`

Demo: `npm run gallery`, then open the new Cooke-glasses tile in both themes and palettes. Each glass gets its
own blue, and the kill criterion gets its verdict. Proves: O1

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #91 | Glass table: 24 to 40 public catalog glasses (Schott, Ohara, CDGM) with name, nd and vd, sourced per row | committed JSON (columns name, catalog, nd, vd, source URL) because the roadmap's oracle names a committed table; considered a catalog fetch at test time (network, unpinned) | `tests/fixtures/glasses.json`, `tests/fixtures/glasses.md` | `tests/unit/glass-table.test.js::table rows are sourced, distinct, in range` | none |
| #92 | Size test for `dist/eleo-layout.js`: gzipped ≤ the baseline recorded at row start + 2048 bytes | node `zlib.gzipSync` in a unit test because it is built in; considered `size-limit` (a new dependency) | `tests/unit/layout-size.test.js`, `packages/plots/README.md`, `README.md` (the stated entry size) | `tests/unit/layout-size.test.js::standalone layout entry within budget` (baseline a literal, `oracle: measurement` at main 48dc2b6) | none |
| #93 | O1 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/glass-fills.spec.js`, `tests/fixtures/glass-fills.html` | `tests/glass-fills.spec.js::glass fills are distinct, stable and ordered` | #91 |
| #94 | Band tokens: `glass-band-hi` and `glass-band-lo` (light and dark) at the band's ends | tokens because the band differs per theme and tokens.css already switches themes; considered offsets from `--glass-crown` (one expression can't fit both themes' asymmetric bands) | `packages/tokens/src/tokens.json` | `tests/unit/tokens.test.js::glass band ends in range` | none |
| #95 | `glassFill(glasses)`: for a layout's distinct `{name, nd, vd}`, a CSS fill per name from the band tokens (vd → mix position, nd → lightness, hue nudge apart). Deterministic over the set sorted by (vd, nd, name) | pure CSS strings because the browser resolves tokens per theme with no redraw, so `Layout2D.svelte` needs no change; considered resolving colors in JS at draw time through `css()` (a redraw on every theme change) | `packages/plots/src/glass.js` | `tests/unit/glass.test.js::same name same fill, parameters ordered by vd` | #94 |
| #96 | `layout2D` fills `{name, nd, vd}` glasses through `glassFill`; the type `glass: "crown" \| "flint" \| Glass \| null` and `Glass` in `index.d.ts`; README `glass` bullet | forced (U12: `glass` also takes `{name, nd, vd}`; shorthand kept per the roadmap's alongside rule) | `packages/plots/src/layout2d.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md` | `tests/unit/layout2d.test.js::object glasses fill per name, shorthand unchanged`, `tests/types/glass.ts` (object accepted, `"BK7"` rejected) | #95 |
| #97 | Gallery tile "Layout2D · Cooke triplet, glasses": a fixture derived from `analysis.json` with SK16 / F2 / SK16 | a derived fixture (`fixture, derived from analysis.json`; glass names from the classic Cooke design) because only the glass field changes and the geometry stays recorded; considered re-recording with the website's `layout.py` (it emits only crown or flint) | `gallery/index.html`, `tests/fixtures/layouts/analysis-glasses.json` | `tests/gallery.spec.js::gallery renders every tile in both themes` (tile count + 1) | #96 |
| #98 | Unskip O1 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/glass-fills.spec.js` | O1 | #91, #92, #93, #94, #95, #96, #97 |

### M2: Glass legend GitHub: `P90 M2: Glass legend`

Demo: the Cooke-glasses tile's footer lists SK16 and F2 with swatches, and `Legend kind="glass"` works in
Svelte. Proves: O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #99 | O2 acceptance test, skipped | forced (`workflow.md`, TDD) | `tests/glass-fills.spec.js` | `::glass legend matches the drawing` | #98 |
| #100 | `glassLegend(layout)`: swatch and name per distinct glass in first-use order, through `glassFill`; exported from `index.js` (both the named exports and `Object.assign(ELEO, …)`, `index.js:8`, so `eleo-plots.js` has it too), `iife-layout.js`, and the `ELEO` interface | in `glass.js` because the standalone entry needs it without `renderers.js`; considered `legend("glass", …)` in `renderers.js` (pulls the full bundle into the entry) | `packages/plots/src/glass.js`, `packages/plots/src/index.js` (+ `iife-layout.js`, `index.d.ts`) | `tests/unit/glass.test.js::legend lists each glass once in first-use order` | #99 |
| #101 | `Legend.svelte` takes `kind="glass"` with `data`; plots-svelte README | forced (U12's legend in the Svelte wrapper). `<Legend kind="glass" data={layout} />` renders one `.eleo-key` per glass | `packages/plots-svelte/src/lib/Legend.svelte`, `packages/plots-svelte/README.md` | `npm run check` types + `tests/unit/glass.test.js` | #100 |
| #102 | Gallery footer legend on the Cooke-glasses tile: a `data-legend="glass"` hook that calls `ELEO.glassLegend(layout)` beside the existing `ELEO.legend(kind)` (`gallery/index.html:109`); unskip O2 | forced (`workflow.md`, TDD: the last item unskips) | `gallery/index.html`, `tests/glass-fills.spec.js` | O2 | #99, #100, #101 |

### M3: Named errors and the release GitHub: `P90 M3: Hardening and release`

Demo: bad inputs throw named errors, the classic gallery reads `ELEO.sample.zimg`, and `npx changeset status`
plans plots and plots-svelte minors and a tokens minor. Proves: O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #103 | O3 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/layout2d.test.js`, `tests/gallery.spec.js` | O3 | #102 |
| #74 reuse | `layoutBounds` requires finite ray points, naming `layouts[k].rays[j][i]`, and a profile on every non-image surface (#75) | the guard at the source because `layout2D` reaches `layoutBounds` only without a box; considered rewording the box error (#74's option 2, doesn't name the point) | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::layoutBounds names a bad input` | #103 |
| #60 reuse | A glass string other than `crown` or `flint` throws `layout2D: surface i glass "BK7" is not crown, flint, null or {name, nd, vd}` | throw because the object form now carries real glasses and the named-error family does the same; considered documenting the crown fallback (hides a bad recording) | `packages/plots/src/layout2d.js` | `tests/unit/layout2d.test.js::unknown glass string throws` (also an object glass without a string `name` or finite `nd`, `vd`) | #74 |
| #76 reuse | `meritTile` catches, logs, and returns `''` | forced (#76's named fix) | `gallery/index.html` | `tests/gallery.spec.js::a rejected merit fixture blanks only its tile` | #103 |
| #47 reuse | The classic build exposes `window.ELEO.sample`; the gallery reads `ELEO.sample.zimg` | `window.ELEO` becomes the API object itself when unset, and gets a `sample` getter when merged, because `useSample` sets `api.sample`; considered `useSample` also writing `window.ELEO.sample` (ties the ESM core to `window`). Only `iife.js` changes: `iife-layout.js` keeps no `sample` (`tests/gallery.spec.js:74`) | `packages/plots/src/iife.js`, `gallery/index.html` | `tests/gallery.spec.js::classic build exposes the sample` | #76 |
| #104 | Release: changesets (plots, plots-svelte and tokens minors), the tokens peer of plots and plots-svelte widened to `>=0.1.0 <1`, `CLAUDE.md` Core line (approved core change) | forced (roadmap: release on consumer pull, phos pulls after C; core change approved with the plan) | `.changeset/*.md`, `packages/plots/package.json`, `packages/plots-svelte/package.json`, `CLAUDE.md` | `tests/unit/release.test.js::tokens peers survive version` (the temp workspace gains tokens) | #103, #74, #60, #76, #47 |

### M4: phos on layout2D GitHub: `P90 M4: phos on layout2D`

Demo: in phos (`npm run tauri dev` against a local phos-core), the Design view draws the sample with
`Layout2D`: per-glass fills, the glass legend, no `render2d.ts`. The draft PR is on ELEOptics/phos. Proves: O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #105 | Spike (timebox 2 h): can phos fetch phos-core's `Material.optical` (`nd`, `vd`) for each interface's `MaterialId`, and capture a `VisualizeSystem2dResponse` for the sample achromat? Output: an issue comment; no production code | forced (`workflow.md`, Work items: a spike answers a question; the critic found nd, vd absent from the Design view) | none | none (spike) | #104 |
| #106 | O4 acceptance test, skipped, with the captured sample response; `@eleoptics/*` added to phos from `npm pack` tarballs of the M3 head (swapped for the released versions in the last item) | forced (`workflow.md`, TDD). The test needs `layout2D` installed. `import type` for aurora types, since type stripping keeps value imports | phos: `src/lib/render/layout.test.ts`, `package.json` (+ `src/lib/render/fixtures/sample-2d.json`) | `layout.test.ts::adapter keeps every point` | #105 |
| #107 | Adapter `toRecordedLayout(response, materials)`: elements → surfaces (z at the vertex, sd = max \|y\|, Aperture → stop, Detector → image, glass `{name, nd, vd}` from `Material.optical`, Fictional skipped) and sources → fans | adapter in phos (roadmap: adapters stay in phos until a second consumer); considered an eleo-ui adapter from aurora types (cut, U11) | phos: `src/lib/render/layout.ts` | `layout.test.ts::adapter keeps every point` | #106 |
| #108 | `opticalModel.svelte.ts` holds the recorded layout from the adapter, not `Render2D` | state first because both views read it; considered converting in each view (two adapters' worth of calls) | phos: `src/lib/state/opticalModel.svelte.ts` | `layout.test.ts` + phos `npm run check` | #107 |
| #109 | `Design.svelte` draws `Layout2D` + `<Legend kind="glass" data={layout} />` | forced (O4) | phos: `src/lib/Design.svelte` | phos `npm run check` | #108 |
| #110 | `BrickDiagram.svelte` off `render2d`; delete `render2d.ts` and `html.ts`; deps at the released versions; unskip O4; open the PR on ELEOptics/phos (draft until the release is on npm) | the deletion lands with the last caller because a dangling import fails `npm run check`; considered deleting first (red between commits) | phos: `src/lib/BrickDiagram.svelte`, `package.json` (+ deletions) | `layout.test.ts` unskipped, phos `npm run check` | #109 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Two catalog glasses in the table land under ΔE 8 even in the widened band (the 12.5 measurement is a best case, not a rule) | O1 fails, and the kill criterion fires again | M1's acceptance test runs on the full table. A fail is the kill signal, and the M1 demo gives the verdict |
| `color-mix` / relative color in a `fill` presentation attribute | fills don't resolve | `layout2D` writes `style="fill:…"`. The Playwright test reads computed fills |
| phos can't reach nd, vd for catalog glasses | O4's glass input is partial | M4's spike, first. A CR before the adapter is written |
| phos-core not runnable locally to capture the response | O4 has no fixture | CR: build the fixture by inverting the sample's recorded layout, as a weaker oracle |
| The release isn't on npm when M4 runs | the phos PR can't install | the PR stays draft and is verified with `npm pack` tarballs. The user merges after the release |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-06 (user): the phos half ships as a PR on ELEOptics/phos from this plan's last milestone. Row C is done when it merges.
- 2026-10-06 (user): make `index.d.ts` and the package `exports` Core in this plan (plan #30's proposal).
- 2026-10-06 (user): C / U12 kill criterion fired before approval (8 glasses inside the crown–flint span reach only ΔE 3.4 / 3.7). Pivot: widen the band to L .66–.93 light / .26–.52 dark, hue 225–275, chroma ≤ .10, and keep the oracle.
- 2026-10-06: critique (general-purpose, claude-fable-5-1), all 12 findings accepted: tokens peer of plots widened too (1); same fill per name within one drawing (2); M4 spike first for nd, vd (3); M4 test deps first (4); `iife.js` only (5); size and release under Constraints, READMEs' size line (6); phos commit rules (7); type test (8); object-glass validation (9); M4 split (10); gallery legend hook (11); `ELEO` export (12). Approach notes applied: band tokens as the named contract, Cooke fixture labelled derived, table columns, legend invocation.
- 2026-10-06 headless: approved, 4 milestones and 24 work items, above the 15-item guideline because M4 runs in a second repo (row: Choose, add or reorder rows).
