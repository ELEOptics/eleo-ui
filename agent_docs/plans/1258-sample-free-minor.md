# Plan #1258: The sample-free 0.x minor

Status: approved 2026-11-20
Branch: `plan/1258-sample-free-minor` PR: #1259 Depends on: plan #1193 (row J) merged into `main` Roadmap: `agent_docs/roadmap.md`, row K
Course check: none — one milestone (user, round 1). Switch signal: #1204 or #1205 stops on one or more baseline entries or shots that only a renderer edit would close

## Problem

Every renderer now has a typed call, but the sample-shaped paths still ship beside them: curve's analysis `kind`,
`rayFan`, the `spot` and `map2D(canvas)` sample calls, `LayoutSystem`, `useSample` and the `./sample` entry, and
`throughFocus` reads only the sample. They keep the sample in every bundle and make the API look wider than it is.
Row K removes them in one breaking 0.x minor, not 1.0: "no client has really used eleo-ui, so much of the API is
untested in the real world" (user, plan #1193 round 2). The scope, outcomes and items were scoped, critiqued and
approved inside plan #1193 and split off to this row at its re-plan (user, 2026-11-20).

## Ground truth (2026-11-20)

- Source: plan #1193's "Moved to row K" (branch `plan/1193-layout3d-typed-major`, dd58f2d), kept word for word
  there. Its ground truth for these items (plan #1193, Ground truth 2026-11-18, "Sample-shaped API still shipped",
  "Gallery tiles on the sample shape", `renderers-baseline.json`, type tests, release) still holds on `main`
  (c2960c8): every file the items name exists.
- Row K is only on J's branch: `main`'s roadmap still has J carrying the breaking release. J's PR #1214 adds row K
  (`After: J`, `next`).
- K shares core and hot files with J's unstarted M2/M3: `packages/plots/package.json` exports, `index.d.ts`,
  `renderers.js`, `index.js`, `build.mjs`, the IIFE entries, `gallery/index.html`, `tests/gallery.spec.js`, both
  READMEs. J's #1254 rewrites the same export and build lines #1212 rewrites. K cannot start before J merges.
- J already carries `@eleoptics/tokens` patch for #158 (`.changeset/stroke-ray-3d.md`) and a plots and plots-svelte
  minor (`.changeset/layout3d-typed.md`). Old O7's "tokens a patch" is J's, not K's.
- Release: plots 0.10.0 on npm; the Version Packages PR 1143 is open with a plots minor (`export.md`). Whether K's
  removals ship as 0.11, 0.12 or 0.13 depends on when 1143 merges against J and K, so a literal version in an error
  message can be wrong (plan #1193 critique finding 13).
- No `Director:` line in `CLAUDE.md`: no row pin.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O5 | No renderer reads the sample or takes an analysis `kind`; each removed call throws a named error. The gallery draws every sample tile from data it passes, through its own adapters, and each draws the same SVG as before. | given the built package, when the removed calls are compiled and called, then each fails the type check and does what the removal table's "After removal" column says (each named error `<fn>: <what> was removed; see the README migration table`, no version number: A2), `./sample` and `./eleo-plots-sample.js` are not exported and no `dist` file carries the sample, and every `renderers-baseline.json` entry drawn through `gallery/sample-adapters.js` and a typed call equals its recorded string | `spec` the removal table (Milestones); `fixture` `tests/fixtures/renderers-baseline.json` (recorded from the plan base, `chromaticFocus` and `rayFan-opd` added by #1203 from the base build, never re-recorded in K) | `tests/types/removed.ts` (through `types.test.js`), `tests/unit/sample-free.test.js`, `tests/unit/split.test.js` |
| O6 | `throughFocus` is typed: the caller passes the defocus values and a row of spot series per field. | given the sample's through-focus spots adapted by the gallery, when `throughFocus` draws them, then the SVG equals the baseline's `throughFocus` entry | `fixture` `renderers-baseline.json` `throughFocus` | `tests/unit/split.test.js` |
| O7 | The breaking release is ready: plots and plots-svelte bump the next minor (the peer stays until plots is published, #1279; CR #1310, user), and the README migration table has a row per removal-table row with its typed replacement, padded glass names included. | given `npx changeset status`, then `.changeset/sample-free.md` bumps plots minor and `sample-free-svelte.md` plots-svelte minor (read in a temp workspace, as "row N changesets"; a consumed twin reads the CHANGELOGs), and the migration table names every removal-table row | `spec` semver for 0.x (a minor may break) and the removal table | `tests/unit/release.test.js` "K changesets", "migration table" |

## Non-goals

- 1.0: waits until a consumer has used the API (user, plan #1193 round 3).
- The tokens patch for #158: J's (`.changeset/stroke-ray-3d.md`).
- Anything in 3D: row J.
- Removing `sample.json` or the gallery's sample tiles: the gallery keeps drawing them through its own adapters (user, plan #1193 round 3).
- New typed calls beyond `throughFocus`: every other removed call already has one.
- Publishing to npm: the user merges the Version Packages PR.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| #1203-#1213 | absorb (reuse) | the items below, scoped in plan #1193 |
| [#139] | absorb (reuse) | glass names reject padding |
| [#125] | supersede | #1210: `LayoutSystem` and `layoutWl`'s sample default go |
| [#639], [#424] | supersede | #1209: the `map2D` canvas call goes |
| [#132], [#133] | supersede | #1212: `iife.js`'s sample getter and the classic merge test's sample go |
| [#86], [#534], [#997], [#1232] | related | release workflow, Legend placement, map2D zoom, layout2D's var() fill: untouched |

## Constraints and assumptions

- A1: K starts only after J (#1193, PR #1214) merges into `main`; `/orchestrate`'s first step merges `origin/main`
  into this branch and resolves `agent_docs/roadmap.md` (J's branch adds row K; this branch sets its Plan and
  Status). #1203 records its baseline entries and base shots on that merged head.
- A2: no literal version in the error messages or the README ("was removed"; the table says "the sample-free minor" and
  the CHANGELOG names the number). plots-svelte's peer is not raised in K: a floor above the workspace's plots breaks `npm ci` until that
  version is on npm, so #1279 raises it after publish (CR #1268, CR #1310, user 2026-11-25).
- A5: the peer bump also covers J's `@eleoptics/plots/layout3d` import in `Layout3D.svelte` (J's plan has no peer
  item). If J ships in a release before K, plots-svelte ships with a peer that admits a plots without `./layout3d`;
  that gap is J's, raised with J's session.
- A3: each item carries every test, type file and README section its change breaks, so each commit keeps the gate
  green (plan #1193 A3, A4).
- A4: neither consumer calls anything K removes (phos uses `layout2D`, `layoutBounds`, `RecordedLayout`; the
  website `eleo-layout.js` and `eleo-physics.js`; checked 2026-11-18).

## Decisions

- No ADR: removing the sample-shaped API follows ADR-0001's plot boundary (typed data, no analysis `kind`).
- Core changes: `packages/plots/package.json` (`exports` loses `./sample` and `./eleo-plots-sample.js`;
  `sideEffects` loses the sample), `packages/plots/src/index.d.ts` (the removed calls and types,
  `ThroughFocusProps`), the roadmap (row K's Plan and Status; the Constraints line "the sample and every gallery tile keep working through
  every row" becomes "every gallery tile keeps working through every row; after K the gallery draws the sample
  through its own adapters", and "J removes `kind` and the sample-shaped `data` in one major release" names K and a
  0.x minor).

## Milestones

### Removal table

The list O5 and O7 test against (critique finding 7). "See the table" in an error is `see the README migration table`.

| Removed | Typed replacement | After removal | Item |
| -- | -- | -- | -- |
| `throughFocus({})`, the sample call | `throughFocus({ defocus, rows })` | throws `throughFocus: the sample call was removed; see the README migration table` | #1205 |
| `curve({ kind })`, `CurveKindProps`, CurvePlot's `kind` | `curve({ series })` or `curve({ panels })` | throws `curve: kind was removed; see the README migration table` | #1206 |
| `rayFan`, `RayFanProps`, `RayFan.svelte` | `curve({ panels })` (the gallery's `fanPanels` adapter shows how) | not exported (type check fails) | #1207 |
| `spot({})` without `panels`, `SpotSampleProps`, SpotDiagram's sample unit | `spot({ panels })` | throws `spot: the sample call was removed; see the README migration table` | #1208 |
| `map2D(canvas, { kind })`, Map2D's canvas branch | `map2D({ values, extent })` | throws `map2D: the canvas call was removed; see the README migration table` | #1209 |
| `layout2D`/`glassLegend` with a `LayoutSystem` (`layout`, `layoutWl`) | `{ data: RecordedLayout }` | throws `layout2D: LayoutSystem was removed; see the README migration table` (`glassLegend:` the same) | #1210 |
| `layout2D({})`, `glassLegend({})` drawing the sample | `{ data: RecordedLayout }` | throws `layout2D: pass { data: RecordedLayout }` (`glassLegend:` the same), as J's layout3D | #1210 |
| `legend(kind)` reading the sample's values | `legend(kind, n, values)` | without `n` or `values` returns `""` (as `index.d.ts:409`'s doc says for no sample) | #1211 |
| padded glass names (`" N-BK7"`) | trimmed names | throws the unknown-glass error | #139 |
| `useSample`, `sample`, `ELEO.sample`, `./sample`, `eleo-plots-sample.js`, `minWidth`'s sample reads | pass data; `gallery/sample-adapters.js` shows the sample | not exported; no `dist` file carries the sample | #1212 (`minWidth` in #1205, #1207, #1208) |

### M1: the sample-free minor GitHub: `P1258 M1: the sample-free minor`

Demo: `SHOTS=1 SHOTS_BASE=<#1203's base shots> npx playwright test gallery-shots` (zero differing tiles);
`node --test tests/unit/types.test.js` (each removed call in `removed.ts` fails without its `@ts-expect-error`);
`node --test tests/unit/sample-free.test.js` (each table row); `npx changeset status`. Proves: O5, O6, O7

Each removal item appends its own `@ts-expect-error` block to `removed.ts` (red as "unused directive" before its
`.d.ts` change) and unskips its own `sample-free.test.js` case, so every item has a red-then-green test of its own
(critique finding 9). #1213 unskips what is left and checks nothing is skipped.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1203 | O5, O6, O7 acceptance tests, skipped: `removed.ts` created empty and registered in `types.test.js`; `sample-free.test.js` with one skipped case per removal-table row, plus "exports", "dist has no sample" and "no tree reference" (no file under `packages/`, `gallery/`, `scripts/`, `tests/` names `sample.js`, `data.js`, `useSample`, `ELEO.sample` or `eleo-plots-sample`, outside this test); `release.test.js` "K changesets", its consumed twin and "migration table", skipped. `chromaticFocus` and `rayFan-opd` (gallery options) recorded into the baseline from the merged base's build: the fixture's diff is two added keys, in `draws()` order, nothing else. The base gallery shots (`SHOTS=1`) taken on the machine that runs the demo and uploaded to the draft `review-assets` release | forced (`workflow.md`, TDD: the first item writes them skipped); the two entries and the shots because O5's oracle and the demo's base must be recorded before anything changes, never from code under test | `tests/types/removed.ts`, `tests/unit/types.test.js`, `tests/unit/sample-free.test.js`, `tests/unit/release.test.js`, `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json` | as O5-O7 (skipped); split.test.js green with the two new entries | J merged (A1) |
| #1204 | `gallery/sample-adapters.js` (classic script, a global): the chromaticFocus adapter, `fanPanels` with rayFan's size and key lines (copied from `fan.js`; `fan.test.js` dies in #1207), the two sample layouts (for the layout2D tiles and J's layout3D tiles) and the key labels; the gallery fetches `sample.json` and draws those tiles by typed calls (the `eleo-plots-sample.js` tag stays until #1212, for the Svelte harness); `record-renderers.mjs` reads `sample.json` and draws through the adapters; gallery.spec's sample-tile tests follow. Stop and ask (finding 15) if an entry or shot differs in a way only a renderer edit would close | a new classic script with a global because the gallery is a classic-script page and `adapters.js` already works that way for node and the page; considered adding them to `tests/fixtures/phos-core/adapters.js`, which holds adapters of phos-core recordings, and the sample is not one; considered an ES module, which needs a module tag and an ordering change. Only what the gallery draws moves: the mtf, field curvature and distortion adapters and `spotPanels` die with their calls | `gallery/sample-adapters.js`, `gallery/index.html`, `scripts/record-renderers.mjs`, `tests/unit/sample-adapters.test.js`, `tests/gallery.spec.js` | split.test.js every entry, sample-adapters.test.js | #1203 |
| #1205 | Typed `throughFocus({ defocus: number[], rows: { title, series: SpotSeries[][] }[], unit, half, width, view, grid })`: `rows[i].series[j]` is the field's spots at `defocus[j]`; RMS computed from the points (1 decimal), the `--ink-subtle` frame on the 0-defocus column, `unit` in header and caption, `half` 40 by default; `minWidth('throughFocus', props)` from `defocus.length`; the sample call throws as the table says; the gallery tile and baseline entry go through the adapter. Stop and ask if the baseline entry differs (finding 15) | keep spot's panel function and replace only the input because O6's oracle is the old SVG; considered dropping throughFocus (user chose typed, plan #1193 round 1) | `packages/plots/src/spot.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `gallery/sample-adapters.js`, `gallery/index.html`, `scripts/record-renderers.mjs`, `packages/plots/README.md`, `tests/unit/spot.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/types/keys.ts`, `tests/types/interact.ts`, `tests/types/curve.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | split.test.js "throughFocus", sample-free.test.js "throughFocus", removed.ts "throughFocus" | #1204 |
| #1206 | Remove curve `kind`: the adapters, `CurveKindProps`, CurvePlot's kind docs; `curve({ kind })` throws as the table says | forced (removal table, O5); considered deleting with no throwing stub, which O5's named error rules out | `packages/plots/src/curve.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `tests/unit/curve.test.js`, `tests/unit/field-order.test.js`, `tests/unit/interact-matrix.test.js`, `tests/types/curve.ts`, `tests/types/keys.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "curve kind", removed.ts "curve kind" | #1205 |
| #1207 | Remove `rayFan` and `RayFan.svelte`; `minWidth('rayFan', props)` falls through `sizes.js`'s curve branch (the same result with `panels`); `PLOT_SIZES.rayFan` stays | `minWidth` falls through because `sizes.js:26-30` already gives that width from `panels`; considered keeping a `fanPanels` branch, which keeps a dead import | `packages/plots/src/fan.js` (deleted), `packages/plots/src/renderers.js`, `packages/plots/src/index.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/RayFan.svelte` (deleted), `packages/plots-svelte/src/lib/index.js`, `README.md` (the file list), the two package READMEs, `tests/unit/fan.test.js` (deleted), `tests/unit/curve.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/unit/plots-svelte.test.js`, `tests/svelte.spec.js`, `tests/fixtures/svelte/ViewHarness.svelte`, `tests/types/curve.ts`, `tests/types/keys.ts`, `tests/types/interact.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | removed.ts "rayFan", sample-free.test.js "rayFan" | #1206 |
| #1208 | Remove the spot sample call: `spotPanels`, `SpotSampleProps`, SpotDiagram's sample unit, `minWidth('spot')`'s sample read; `spot({})` throws as the table says; the Svelte harness's `SpotDiagram` gets typed `panels` | forced (removal table, O5); considered deleting with no throwing stub, which O5's named error rules out | `packages/plots/src/spot.js`, `packages/plots/src/sizes.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/SpotDiagram.svelte`, the two package READMEs, `tests/unit/spot.test.js`, `tests/unit/scale.test.js`, `tests/unit/field-order.test.js`, `tests/unit/interact-matrix.test.js`, `tests/svelte.spec.js`, `tests/types/panels.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "spot sample", removed.ts "spot sample" | #1207 |
| #1209 | Remove `map2D(canvas, …)` and Map2D's canvas branch; `map2D(canvas)` throws as the table says; the chromium-only list loses `map2d-sample` | forced (removal table, O5); supersedes [#639], [#424]; considered deleting with no throwing stub, which O5's named error rules out | `packages/plots/src/map2d.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Map2D.svelte`, `packages/plots-svelte/src/fixtures/Map2DTypes.svelte`, `README.md` (the quickstart's `map2D` and `<Map2D kind>`), the two package READMEs, `tests/map2d-sample.spec.js` (deleted), `tests/fixtures/map2d-baseline.json` (deleted), `scripts/record-map2d-baseline.mjs` (deleted), `playwright.config.js`, `tests/unit/gate.test.js`, `tests/unit/map2d-svelte.test.js`, `tests/types/map2d.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "map2D canvas", removed.ts "map2D canvas" | #1208 |
| #1210 | `layout2D` and `glassLegend` take a `RecordedLayout` only: both guards in `layout2d.js` and `glass.js` (so `eleo-layout.js`, which imports `layout2d.js` directly, gets them too), `renderers.js`'s sample wrapper deleted and `layout2d.js`'s function registered; `colorBy` stays as the aria-label word; errors as the table says; `data.test.js` (sample draws) deleted; the Svelte harness's `Layout2D` gets a recorded layout | guard in `layout2d.js` because `iife-layout.js:2` bypasses `renderers.js` (critique finding 1); considered the guard in `renderers.js`, which leaves the website's entry reading `layout`/`layoutWl`; supersedes [#125] | `packages/plots/src/layout2d.js`, `packages/plots/src/renderers.js`, `packages/plots/src/glass.js`, `packages/plots/src/index.d.ts`, `packages/plots-svelte/src/lib/Legend.svelte`, `packages/plots/README.md`, `tests/unit/layout2d.test.js`, `tests/unit/glass.test.js`, `tests/unit/interact-matrix.test.js`, `tests/unit/field-order.test.js`, `tests/unit/data.test.js` (deleted), `tests/svelte.spec.js`, `tests/types/glass.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "LayoutSystem", "no data", removed.ts "LayoutSystem" | #1209 |
| #1211 | `legend` keys values only from `values`; without `n` or `values` it returns `""` | forced (removal table, O5); considered a throw without values, which breaks every caller drawing index keys with `n` | `packages/plots/src/legend.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `tests/unit/legend.test.js`, `tests/types/keys.ts` | legend.test.js "values only" | #1210 |
| #139 reuse | Reject padded glass names (`g.name === g.name.trim()`) with one case in "unknown glass string throws" | as the issue names it, because a trimmed name is the only form both legend and fill agree on; considered trimming silently, which hides a data error | `packages/plots/src/glass.js`, `packages/plots/README.md`, `tests/unit/glass.test.js` | glass.test.js "unknown glass string throws" | #1211 |
| #1212 | Remove `useSample`, `sample`, `data.js`, `sample.js`, `sample.d.ts`, `iife-sample.js` and `iife.js`'s sample getter; `index.js`'s `useSample` export and header; `exports` and `sideEffects` and the build without the sample; the gallery's `eleo-plots-sample.js` tag; every test that still imports `sample.js` or reads `ELEO.sample` (J's included) passes its data; the classic merge test without it; `scripts/sample-layout.mjs` (spent) deleted | forced (removal table, O5; core: package.json exports); supersedes [#132], [#133]; considered splitting entry/build from `useSample`, which leaves the build exporting a deleted module between the two | `packages/plots/src/data.js`, `sample.js`, `sample.d.ts`, `iife-sample.js` (deleted), `packages/plots/src/iife.js`, `index.js`, `renderers.js`, `index.d.ts`, `packages/plots/package.json`, `packages/plots/build.mjs`, `packages/plots-svelte/src/lib/index.js`, `README.md`, the two package READMEs, `gallery/index.html`, `scripts/sample-layout.mjs` (deleted), `tests/fixtures/classic-merge.html`, `tests/gallery.spec.js`, `tests/svelte.spec.js`, `tests/unit/curve.test.js`, `tests/unit/legend.test.js`, `tests/unit/layout2d.test.js`, `tests/unit/layout3d.test.js`, `tests/unit/field-order.test.js`, `tests/unit/interact-matrix.test.js`, `tests/unit/scale.test.js`, `tests/types/interact.ts`, `tests/types/removed.ts`, `tests/unit/sample-free.test.js` | sample-free.test.js "exports", "dist has no sample", "no tree reference", removed.ts "useSample" | #139 |
| #1308 | CR #1307: comments still naming the code K deleted (`fan.js`, `fan.test.js`, `CurveKindProps`) say where it lives now; `sample-free.test.js` "no tree reference" also refuses `fan.js`, `fan.test.js`, `CurveKindProps`, `RayFanProps` and `curveAdapters` | extend the existing "no tree reference" scan because it already walks those trees; considered a second scan, which repeats the walk | `tests/unit/sample-free.test.js`; comment lines in `gallery/sample-adapters.js`, `tests/fixtures/phos-core/adapters.js`, `packages/plots/src/scale.js`, `tests/unit/split.test.js`, `tests/types/bars.ts` | sample-free.test.js "no tree reference" | #1212 |
| #1213 | Changesets in two files (`sample-free.md`: plots minor; `sample-free-svelte.md`: plots-svelte minor, RayFan removed); no peer raise (CR #1310, user: after publish, #1279); the README migration table, one row per removal-table row, headed "removed in the sample-free minor (the CHANGELOG names its version)", folding in "Migration: `data.layout`"; unskip what is left | two files because changesets writes one body into every package it bumps (`release.test.js:204`, #85); considered one file, which puts RayFan's removal in plots' CHANGELOG | `.changeset/sample-free.md`, `.changeset/sample-free-svelte.md`, `packages/plots/README.md`, `tests/unit/release.test.js`, `tests/unit/sample-free.test.js`, `tests/types/removed.ts` | O5, O7; "K changesets" (temp workspace: plots and plots-svelte minor), its consumed twin (both CHANGELOGs carry them) | #1203, #1204, #1205, #1206, #1207, #1208, #1209, #1210, #1211, #139, #1212, #1308 |
| #1314 | Docs after K: plots-svelte README's `Legend kind="glass"` takes a recorded layout (CR #1311); plots README's throughFocus caption needs a `unit` (CR #1312); the roadmap's Constraints clause gets the Decisions wording (CR #1313) | forced (review M1 round 1, findings 1-3) | `packages/plots-svelte/README.md`, `packages/plots/README.md`, `agent_docs/roadmap.md` | docs only: the CRs' greps print nothing | none |
| #1315 | `throughFocus` throws `throughFocus: rows[i].series[j] is not an array of series` on a malformed row; `spot.js`'s header says the caption needs a `unit` (CR #1312) | a per-cell `Array.isArray` guard because classic-script callers get no `.d.ts` check (finding 4, backlog); considered validating every point, which `live()` already filters | `packages/plots/src/spot.js` | spot.test.js "throughFocus names a malformed row" | none |
| #1317 | `throughFocus` names a non-array `series` and a non-object series entry; README:202 lists its errors (review M1 round 2, findings 1-3, backlog) | name both because #1315 set out to replace unnamed errors and silent empties, and these are the two left; considered `(se && se.points) \|\| []`, which draws a null entry as empty | `packages/plots/src/spot.js`, `packages/plots/README.md` | spot.test.js "throughFocus names a malformed row" | none |

Every item lists more than two files except #139: each removal carries the tests, type files and README sections it
breaks (A3), and each is one behaviour.

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| J's M2/M3 change a file an item lists (exports, gallery, READMEs) | item Files and line references go stale | A1: merge `main` first; the worker reads the merged file, the Files list names files, not lines |
| An adapter-drawn tile differs from its baseline | O5 fails | the baseline is recorded from the merged base before any change (#1203); #1204 and #1205 stop and ask when only a renderer edit would close it (counts: failing split.test.js entries, differing shots; the check that stands in for a course check, finding 15) |
| J adds a file that reads the sample after this plan is approved (e.g. #1254's export test) | #1212 misses it | "no tree reference" (#1203) names it; the orchestrator adds it to #1212's Files by CR (it keeps every invariant) |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-20 draft, from plan #1193's "Moved to row K" (approved there 2026-11-18, re-plan 2026-11-20). Proposed
  changes against it: #1203 runs after J's merge, not after #1202, and records the base shots (J's M2 shots are no
  base for K); O7 drops the tokens patch (J's); the error messages drop "in 0.11" (A2); the release test is
  "K changesets".
- 2026-11-20 round 1 (user): buckets confirmed (absorb #1203-#1213, [#139]; supersede [#125], [#639], [#424], [#132],
  [#133]; related [#86], #534, #997, #1232). The error messages drop the version: "was removed; see the README
  migration table" (O5's acceptance test, changed by the user). K branches from `main` and waits for J's merge (A1).
  One milestone, as approved in plan #1193.

- 2026-11-20 critique (plan critic, claude-fable-5-1): 16 findings, all applied. 1: #1210 guards in `layout2d.js`
  (the website's `eleo-layout.js` bypasses `renderers.js`). 2, 4, 5, 6: the missing tests and type files go into the
  item that breaks them (`svelte.spec.js` in #1207, #1208, #1210, #1212; `data.test.js` deleted in #1210; J's
  `layout3d.test.js` and `field-order.test.js` in #1212; the eleo-plots-sample tag stays until #1212). 3: #1209 lists
  `gate.test.js` and `playwright.config.js`. 7: the removal table, now O5's and O7's oracle. 8: A2 rewritten, the
  peer's release tests. 9: each removal item owns its `removed.ts` block and `sample-free` case. 10: `files`, stray
  line, roadmap constraint. 11: root `README.md` and the plots-svelte README lines. 12: #1203's fixture diff is two
  keys; shots on the demo machine. 13: two changeset files. 14: `fanPanels` copied. 15: stop conditions on #1204 and
  #1205 in place of a course check (one milestone kept). 16: A5, the peer covers J's `./layout3d`. Approach cells:
  #1204 states why not `adapters.js`; #1207 falls through `minWidth`'s curve branch; #1206, #1208, #1209 cite the
  table; #1212 not split (the build would export a deleted module between the halves).

- 2026-11-20 approved (user). Published: plan issue #1258, milestone `P1258 M1: the sample-free minor`, #1203-#1213 and #139 moved onto it.
- 2026-11-25 main (J, PR #1214) merged in (A1), 637091e; `tests/unit/layout3d.test.js`'s seven oracle comments got their kind word (the pre-commit hook reads J's files as added in the merge).
- 2026-11-25 CR #1307 (stale comments naming `fan.js`, `fan.test.js`, `CurveKindProps`, from #1206 and #1207) accepted by the orchestrator: item #1308, after #1212; #1213 runs after it.
- 2026-11-25 CR #1310 (user): after publish. O7 and #1213 drop the plots-svelte peer raise: `>=0.11.0 <1` breaks `npm ci` until plots 0.11.0 is on npm, the reason CR #1268 put it after publish; #1279 keeps it. A2's peer clause and the Version Packages risk row go with it.
- 2026-11-25 review M1 round 1 (code-reviewer): 3 blocking (stale docs), filed as CRs #1311, #1312, #1313 and accepted by the orchestrator (doc fixes; the roadmap edit is a listed core change); 2 backlog pulled into M1 (small, named, in files M1 changed). Items #1314 (docs), #1315 (throughFocus guard), #1316 (glass.js alias).
- 2026-11-25 #1316 back to the backlog (orchestrator): a pure refactor has no failing test and `check-tests-touched.sh` refuses the commit; the next plan changing `glass.js` takes it.
- 2026-11-25 review M1 round 2 (code-reviewer): 0 blocking; CRs #1311-#1313 resolved; 3 backlog in `spot.js` and its README entry pulled into M1 as #1317 (small, named, in files M1 changed).

[#125]: https://github.com/ELEOptics/eleo-ui/issues/125
[#132]: https://github.com/ELEOptics/eleo-ui/issues/132
[#133]: https://github.com/ELEOptics/eleo-ui/issues/133
[#139]: https://github.com/ELEOptics/eleo-ui/issues/139
[#86]: https://github.com/ELEOptics/eleo-ui/issues/86
[#424]: https://github.com/ELEOptics/eleo-ui/issues/424
[#639]: https://github.com/ELEOptics/eleo-ui/issues/639
