# Plan #162: Renderer modules and a generic curve

Status: approved 2026-10-08
Branch: `plan/162-curve-typed` PR: #186 Depends on: plan #144 (done) Roadmap: `agent_docs/roadmap.md`, row D

## Problem

phos wants to build its analysis plots from eleo-ui's plot types instead of keeping its own (roadmap group "Plot
types for phos"). Today `curve` only draws the four analyses the sample carries, picked by `kind`, and reads the
sample's own shapes. All the non-layout renderers sit in one 28.7 kB `renderers.js`, so rows E, F and G would
collide in it. Row D splits that file, writes the styling rule down as the first ADR, and makes `curve` take typed
series, proven on MTF, field curvature and distortion recorded from phos-core.

## Ground truth

- `packages/plots/src/renderers.js` (297 lines) holds the shared helpers (`data`, `useSample`, `fmt`, `css`,
  `rgb`, `ramp`, `mapStops`, `gradient`, `VIRIDIS`, `GRAY`), and the renderers `layout3D`, `spot`, `throughFocus`,
  `rayFan`, `map2D`, `curve`, `legend` and the icon set. Together they form one IIFE-shaped `ELEO` object.
  `index.js` merges physics, `layoutBounds` and `glassLegend` into it and re-exports the names. `layout2d.js`,
  `glass.js` and `common.js` (`STANDARD`, `NS`, `idx`, `svg`) are already modules.
- `curve` (`renderers.js:179-205`) branches on `kind` (`mtf`, `fieldCurvature`, `distortion`, else chromatic focus).
  Each branch reads a sample field (`D.mtf`, `D.fieldCurv`, `D.distortion`, `D.chromFocus`) and hard-codes ranges,
  ticks, labels and styles. It maps through `X()`/`Y()` into pixels with no transform, and draws MTF's diffraction
  curve as `var(--ink)` with dash `1 3` and width 1.25. Tangential is solid and sagittal dashed `5 3`, both in
  `idx(i)`.
- `legend(kind, n)` (`renderers.js:208`) reads `S.fields` / `S.wl`. With no sample loaded `S` is null, so
  `legend('field')` throws. That is #121, and `<Legend kind="field">` hits it under SSR.
- `index.d.ts` (Core) types `CurvePlotProps` as `{ data?, kind, width?, height? }`. `CurvePlot.svelte` passes
  its props through to `curve`.
- Gallery (`gallery/index.html:75-100`): `sampleTile` wraps ten sample tiles. The merit and glasses tiles fetch
  fixtures and blank only their own tile if a fetch fails (`tests/gallery.spec.js:34-80`).
- Literals the U5 lint would match: the viridis and gray maps (`renderers.js:18-19`, and viridis again in `physics.js:34`'s `colormap`: named colormaps, exempt).
  `monospace` is layout3D's label font (`:88`, exempt). The `rgb(` hits are string-built from computed colors,
  not literals. `layout2d.js:8` names the `font-family` attribute with `var(--font-mono)`. `glass.js:4` has `#134`,
  an issue number in a comment.
- phos-core (ELEOptics/phos-core, not cloned here) has a uniffi Python client at `clients/python`. `dev.sh` builds
  the `phos` cdylib with cargo and copies `phos.py` plus the library into `clients/python/src/phos/`. `phos.py`
  exposes `ModulationTransfer2dSettings.run(model) -> [ModulationTransfer2d]` (`tangential()`, `sagittal()`:
  `List[List[Point2]]`, `wavelengths()`), `FieldCurvatureSettings.run` (`results() -> [FieldFocus]`),
  `DistortionSettings.run` (`results() -> [DistortionData{wavelength, real_height, paraxial_height, percent}]`),
  `OpticalModel.cooke_triplet_kingslake()`, `OpticalModel.from_lens_table`, `material(name, vendor)`,
  `first_order_data`, `PolychromaticModulationTransferSettings` (one `tangential()`/`sagittal()` `List[Point2]` per source), `LensTable`, `Surf(radius, thickness, MaterialSpec, conic)`, `MaterialSpec.CATALOG(name, vendor)`. Results are per source (`RelativeSource`, normalized) and give image heights, not field angles. phos-core's MTF has no diffraction-limit curve. Local toolchain: cargo 1.94, Python 3.11.
- The sample (`sample.json`) is "N-BK7/SF5 cemented achromat R 62.8/-45.7/-128.2 mm, EPD 25 mm, fields 0/1/2 deg,
  486.1/587.6/656.3 nm". Its surface z's come from `sample.layout.surfaces`, and its `efl` from an independent
  trace. Its `mtf.diff` is the diffraction curve the tile draws today.
- `physics.js` has `j1`, `airy`, `airyRadius`, `slabMode`, `colormap`, and no diffraction MTF.
- `tests/unit/glass.test.js:134` already renders a Svelte component server-side (`svelte/server`).
- `tests/unit/types.test.js` runs `tsc --strict` on `tests/types/*.ts` against `index.d.ts`.
- ADRs: none yet (`agent_docs/adr/0000-template.md` only). `zensical.toml` exists, so each ADR gets a
  `dev_docs/adr/` symlink and a nav line (`workflow.md`, Docs).
- `scripts/check-tests-touched.sh` refuses a commit that changes `packages/*/src/` with no test file.
- Prior art. Tick values: d3-array's `ticks` is the maintained tool, but it would be a new runtime dependency
  (the user's call), and Heckbert's nice-numbers rule (Graphics Gems, 1990) is about 15 lines with published
  cases, so the plan writes it with that oracle. Clipping: a nested `<svg>` viewport clips with no ids.
  Recording: phos-core's own Python client. Diffraction MTF: the closed form for a circular pupil (Goodman,
  *Introduction to Fourier Optics*).

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `curve` draws typed series with no `kind`: points, a role per series (index k by field or wavelength; tangential, sagittal or reference), and axes with label and unit. MTF is built by the caller from recorded phos-core results. | given the recorded polychromatic MTF of the sample achromat and of the Cooke triplet, built into one tangential and one sagittal series per field by `tests/fixtures/phos-core/adapters.js`, when drawn with `curve({ series, x, y })` at 460 and 920 px, then inverting the series group's transform recovers every in-range point within 0.5 px | `fixture: phos-core PolychromaticModulationTransfer recorded by scripts/record-phos-core.py (roadmap U6)` | `tests/unit/curve.test.js::recorded MTF round trip (U6)` |
| O2 | `renderers.js` is split into one module per renderer plus a data module, and `renderers.js` keeps only the assembly. The output is unchanged. | given main's build at the plan's base, when every SVG renderer other than `curve` draws the sample with its gallery options, then each string equals the one recorded at the base; `ELEO.sample` is the sample after `useSample`; the canvas tiles are compared by eye at the M1 demo against main's screenshots | `fixture: SVG markup from main's dist at the plan's base, recorded by scripts/record-renderers.mjs`; `user: gallery screenshots at the row's start (roadmap Design references, U5–U10)` | `tests/unit/split.test.js::SVG renderers draw the base markup` |
| O3 | Field curvature and distortion are built by the caller from recorded phos-core results, with field angle on y, and MTF shows the diffraction limit from the closed form. | as O1, for the recorded FieldCurvature and Distortion of both lenses (y = the recorded field angle of each source), and the MTF diffraction series from `mtfDiffraction` | `fixture: phos-core FieldCurvature and Distortion recorded by scripts/record-phos-core.py (roadmap U6)`; `closed-form Goodman, Introduction to Fourier Optics, incoherent MTF of a circular pupil` | `tests/unit/curve.test.js::recorded field curvature and distortion round trip (U6)` |
| O4 | ADR-0001 fixes the boundary and the styling rule, and no color literal or font name appears in `packages/plots/src` outside the exemptions. | given every `.js` file in `packages/plots/src` with comments stripped, when it is scanned for hex colors, `rgb()`/`hsl()`/`oklch()` with numeric arguments, and font family names, then only the named colormaps (viridis and gray in `color.js`, viridis in `physics.js`'s `colormap`) and layout3D's tone composition and label font match | `property: roadmap U5's oracle` | `tests/unit/style-lint.test.js::no color or font literal outside the exemptions (U5)` |
| O5 | `legend` and `<Legend>` with a non-glass kind render without the sample (SSR included). | given no sample loaded, when `Legend` is rendered with `svelte/server` for `field` and `wavelength` with `n: 3`, and for `ts` and `rays` with no `n`, then it doesn't throw; the index kinds give `n` keys without values (`F1`, `λ1`, …), and with no `n` none; `ts` and `rays` are unchanged | `spec #121` | `tests/unit/legend.test.js::non-glass legends render without the sample (#121)` |
| O6 | The release is planned: a plots minor. | given the branch, when `.changeset/curve-typed.md`'s front matter is parsed, then it is `{"@eleoptics/plots": "minor"}`; skipped once consumed, when its twin finds the plots CHANGELOG entry under `### Minor Changes` | `spec roadmap Constraints (a typed API added alongside the old ships as a minor); semver 0.x`. plots-svelte's peer range `>=0.1.0 <1` admits it, so it gets no bump (`release.test.js:1-3`, plan #30's O4) | `tests/unit/release.test.js::curve-typed changeset asks a plots minor`, `::curve-typed changeset became a plots minor` |

## Non-goals

- Panels in `curve`, the ray and OPD fans, and the cumulative probability curve: these are row E (U6's E half).
- Limit lines and bands: these are row G (U9).
- Removing `kind` or the sample-shaped `data`: row J's major release. `kind` stays, as an adapter that builds series
  from the sample.
- Chromatic focus from phos-core: phos-core doesn't compute it (roadmap). It stays on sample data through the
  `kind` adapter.
- A legacy REST client in `record-phos-core.py`: D's three analyses are all in the uniffi client. Row E adds REST
  for anything it needs.
- Adapters from phos-core types in `packages/`: U11 keeps them in phos. The gallery's adapters live in
  `tests/fixtures/phos-core/adapters.js`.
- d3 or Observable Plot as a dependency: ADR-0001 weighs them and records why not.
- Typed `legend` input (roles and labels from the caller): #121 needs only the null guard. Typed legends come
  with H's plot shell.
- A plots-svelte release: no component changes beyond a comment (O6).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| #121 | absorb | reused as work item #121 (O5); the split moves `legend` into its own module |
| #137 | absorb | reused as work item #137; this row moves sample tiles to recorded data |
| #132, #133 | related | iife.js and the classic-merge tests: the split keeps `ELEO.sample`'s behaviour (O2) without touching them |
| #158 | related | waits on row J |
| #70, #125, #136, #138, #139, #156, #160 | related | layout2D hardening, deferred (roadmap 2026-10-08). D doesn't edit `layout2d.js` or `glass.js` |
| #86 | related | release.yml, untouched |

## Constraints and assumptions

- Roadmap constraints: the typed API is added alongside the old one; every gallery tile keeps working; recorded
  fixtures are public lenses only (the sample achromat, the Cooke triplet); `eleo-layout.js` grows by at most
  2 kB gzipped (the split must not pull `renderers.js` into it); U14's redraw budget holds for `curve`.
- Assumption: `clients/python/dev.sh` builds the `phos` cdylib on the developer's Mac without the server's
  Postgres. If it doesn't, #169 stops (Risks).
- Assumption: a `LensTable` reproduces the sample achromat. Its wavelengths are the sample's, with reference
  587.6 nm. Its aperture is `SystemAperture.entrance_pupil_diameter(25)` (the note: `sample.json` has no EPD
  field), and its fields are `FieldSpec.ANGLES([0, 1, 2])`. Surfaces are `Surf(radius, thickness, MaterialSpec.CATALOG("N-BK7" | "SF5", "SCHOTT"), conic)`, with z's and sd's from `sample.layout.surfaces`. #169
  checks it: `first_order_data(0)`'s focal length must be within 0.1% of `sample.efl`.
- Results are per source (`RelativeSource`, normalized) and carry image heights, not angles. So #169 records each
  source's field angle: from the lens table for the achromat, and from `OpticalModel.cooke_triplet_kingslake()`'s
  field spec for the triplet. It also records the wavelengths and the frequency unit of the MTF's `Point2.x`
  (stop if it isn't cycles/mm or convertible to it).
- Fixtures record phos-core's commit sha and the script's arguments, so they can be re-recorded.
- `tests/fixtures/phos-core/adapters.js` has no `import` or `export`: it assigns `globalThis.ELEOAdapters`. So
  it loads as a classic script in the gallery and through `await import()` in Node, the package being
  `"type": "module"`.
- Running `record-phos-core.py` is not part of the gate. The fixtures are committed.
- `tests/perf.spec.js` runs only with `PERF=1`, so the full gate doesn't pay for an assertion-free test.

## Decisions

- ADR-0001 (written `proposed` in M1 by #170; M1's demo gives the verdict): eleo-ui ships renderers by data shape
  plus the plot shell and holds no app state; options carry data, labels and roles, never color, font or stroke
  width; CSS custom properties on an ancestor are the one override; Observable Plot and d3 weighed and not adopted.
  It also records the curve drawing choice below and its alternative (px-space polylines with `data-x`/`data-y`).
- Series are drawn in a nested `<svg>` (clipping) holding a `<g transform>` in data coordinates under
  `vector-effect="non-scaling-stroke"`, as layout2D does. That makes U6's "inverting each SVG's transform" literal.
- Role → style (ADR-0001): `index: k` → `idx(k)`; `tangential` solid, `sagittal` dash `5 3`; `reference`
  `var(--ink)` dash `1 3`; every role 1 px (user, M1 demo, CR #209). A zero line in `--plot-axis` whenever an axis range straddles 0. These are
  today's styles, so the look is kept.
- O2 and `curve`: #173 changes `curve`'s markup (the transform group), so it deletes `curve`'s entries from
  `renderers-baseline.json`. Re-recording them from the new code would make the code its own oracle
  (`workflow.md`, Anti-patterns). `curve`'s `kind` path is covered by #173's metamorphic test and by M1's demo by
  eye (roadmap kill criterion D–J).
- The gallery's MTF, field curvature and distortion tiles draw the recorded sample achromat: the same lens as
  the baseline, so the tile count stays 17. The Cooke triplet is used in the unit tests only.
- Core changes approved with the plan: `packages/plots/src/index.d.ts` (`CurveSeries`, `CurveAxis`,
  `CurvePlotProps` with `series`/`x`/`y` alongside `kind`; `legend`'s comment, which says what it draws without
  the sample) and `physics.d.ts` (`mtfDiffraction`); `agent_docs/adr/` (ADR-0001). No `exports` change: the new
  modules are internal, re-exported through `index.js`.

## Milestones

### M1: Split, and recorded MTF through a generic curve GitHub: `P162 M1: Split, and recorded MTF through a generic curve`

Demo: before the first change, the orchestrator screenshots main's gallery at the plan's base: every tile, both
themes and both vision palettes, `page.screenshot` per tile from a scratchpad script, named
`d-base-<sha>-<theme>-<palette>-<tile>.png`. It uploads them with `gh release upload review-assets --clobber`
(never committed). At the demo, `npm run gallery` shows the MTF tile drawn from the recorded achromat beside its
baseline, and every other tile as it was, the canvas tiles included. ADR-0001 is read and gets its verdict.
Proves: O1, O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #163 | Record main's SVG markup and guard it: O2's test | a Node script that imports `packages/plots/dist` built from the plan's base and writes each SVG renderer's output with the gallery's options to JSON, because a committed fixture lets the test run anywhere without the base checkout; considered importing a `git worktree` of the base in the test (needs the checkout and a second build each run) and Playwright pixel snapshots (platform-bound). `node scripts/record-renderers.mjs` → `wrote tests/fixtures/renderers-baseline.json (N renderers)`. Green from the start: it guards the moves | `scripts/record-renderers.mjs`, `tests/fixtures/renderers-baseline.json`, `tests/unit/split.test.js` | `split.test.js::SVG renderers draw the base markup` |  |
| #164 | O1 acceptance test, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/curve.test.js` | `curve.test.js::recorded MTF round trip (U6)`, skipped |  |
| #165 | Move the shared helpers out of `renderers.js`: `data.js` (sample state, `data`, `useSample`) and `color.js` (`fmt`, `css`, `rgb`, `ramp`, `mapStops`, `gradient`, the named maps, `hollow`, `marker`). `ELEO.sample` becomes a getter over `data.js`'s state | plain ES modules, because the renderer modules (#166, #167, #168) import them and must not import `renderers.js` back (a cycle); considered keeping `fmt`/`css`/`gradient` in `renderers.js`, which forces that cycle once `map2D` and `layout3D` move | `packages/plots/src/data.js`, `packages/plots/src/color.js`, `packages/plots/src/renderers.js` | `split.test.js` stays green; `data.test.js::useSample sets ELEO.sample and reaches every renderer` | #163 |
| #166 | Move `curve` and `legend` into `curve.js` and `legend.js` | forced (roadmap row D: one module per renderer); verbatim moves | `packages/plots/src/curve.js`, `packages/plots/src/legend.js`, `packages/plots/src/renderers.js` | `split.test.js` stays green | #165 |
| #167 | Move `spot`, `throughFocus` and `rayFan` into `spot.js` and `fan.js` | forced (roadmap row D: rows E, F and G must touch disjoint renderer modules); verbatim | `packages/plots/src/spot.js`, `packages/plots/src/fan.js`, `packages/plots/src/renderers.js` | `split.test.js` stays green | #166 |
| #168 | Move `map2D`, `layout3D` and the icons into `map2d.js`, `layout3d.js` and `icons.js`; `renderers.js` keeps only the assembly | forced (roadmap row D); verbatim | `packages/plots/src/map2d.js`, `packages/plots/src/layout3d.js`, `packages/plots/src/icons.js`, `packages/plots/src/renderers.js` | `split.test.js` stays green; `gallery.spec.js::canvas maps follow their theme` | #167 |
| #188 | README's "A renderer" bullet names the modules (CR #187) | forced (CR #187: `README.md:65` says `renderers.js` holds "the rest", stale after the split) | `README.md` | none: doc only; `check.sh --fast` green | #168 |
| #169 | `scripts/record-phos-core.py`: polychromatic MTF, field curvature, distortion, first-order data, field angles and wavelengths for the sample achromat and the Cooke triplet | phos-core's uniffi Python client, because the roadmap names it (U6) and it has all three analyses; considered phos-core's REST server, which needs Postgres and Docker. The achromat as in Constraints. `python3 scripts/record-phos-core.py --phos <phos-core>/clients/python/src` → `wrote tests/fixtures/phos-core/{achromat,cooke}-{mtf,field-curvature,distortion}.json (phos-core <sha>)`. The header says how to build the client (`clients/python/dev.sh`). Stop and report if `dev.sh` fails to build, if the achromat's efl is off by more than 0.1%, or if the MTF's frequency unit isn't cycles/mm | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/*.json`, `tests/fixtures/phos-core/README.md` | `tests/unit/phos-core-fixtures.test.js::recorded achromat is the sample` (efl within 0.1% of `sample.efl`; fields and wavelengths equal) |  |
| #170 | ADR-0001: plot boundary and styling rule, `proposed` | forced (roadmap U5: an ADR fixes the boundary and the styling rule and weighs Observable Plot and d3); the symlink and nav line are forced by `workflow.md`, Docs | `agent_docs/adr/0001-plot-boundary.md`, `dev_docs/adr/0001-plot-boundary.md` (symlink), `zensical.toml` | `zensical build --strict` in the full gate |  |
| #171 | `niceTicks(lo, hi, n)` → `{ ticks, decimals }`, and `niceRange` | Heckbert's nice numbers (1, 2, 5 × 10^k, decimals from the step), because it is the published rule behind d3's ticks and fits in about 15 lines with no dependency; considered d3-array (a new dependency, the user's call) and requiring the caller to pass ticks (every caller re-solves it) | `packages/plots/src/axis.js`, `tests/unit/axis.test.js` | `axis.test.js::Heckbert's examples` (oracle: paper Heckbert 1990, Graphics Gems, "Nice numbers for graph labels") |  |
| #172 | `curve({ series, x, y, width, height })`: typed series with roles; README `curve` entry | a nested `<svg>` viewport with a data-space `<g transform>` (Decisions), because U6's oracle inverts a transform and the viewport clips with no page-unique ids; considered `clipPath` (needs unique ids). Roles map to styles in one table (ADR-0001). Axis: `{ label, unit?, range?, ticks? }`, drawn as `label, unit`; ticks and decimals default from #171. Invocation: `curve({ series: [{ points: [[0, 1], [100, .62]], index: 0, role: "tangential" }], x: { label: "Spatial frequency", unit: "cycles/mm", range: [0, 400] }, y: { label: "Modulus", range: [0, 1] } })` → an `<svg>` whose series group carries `transform="matrix(…)"` | `packages/plots/src/curve.js`, `tests/unit/curve.test.js`, `packages/plots/README.md` | `curve.test.js::series round trip` (synthetic points, recovered within 0.5 px) | #166, #171 |
| #173 | `kind` becomes an adapter that builds series from the sample and calls #172's path; `curve`'s entries leave `renderers-baseline.json` | forced (roadmap Constraints: the old API stays until J; kill criterion D/U6: no analysis branch in the drawing). Considered re-recording `curve`'s baseline, which makes the code its own oracle (Decisions) | `packages/plots/src/curve.js`, `tests/unit/curve.test.js`, `tests/fixtures/renderers-baseline.json` | `curve.test.js::kind draws its adapter's series` (metamorphic: `curve({kind})` equals `curve(adapter(sample))`, and each adapter's points are the sample's) | #172 |
| #174 | Gallery MTF tile from the recorded achromat, through `tests/fixtures/phos-core/adapters.js` (a classic script, Constraints), awaited before `draw()` | a fetched fixture that blanks only its own tile on failure, as the merit tile does, because the page must draw when a fixture is missing; considered bundling the fixture into the gallery script (the gallery has no bundler). The MTF tile no longer needs the sample, so it joins `ownData` in the missing-sample test | `gallery/index.html`, `tests/fixtures/phos-core/adapters.js`, `tests/gallery.spec.js` | `gallery.spec.js::a missing phos-core fixture blanks only its tile`; `::a missing sample script blanks only the sample tiles` updated | #169, #173 |
| #175 | Unskip O1 | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/curve.test.js` | O1 | all above |
| #189 | CR (review M1 finding 1): both round-trip tests pin M to the caller's ranges and the tick lines | the expected pixels must come from the caller's ranges, not the emitted M (`workflow.md`, Anti-patterns); considered a fixed-pixel fixture (brittle to layout constants) | `tests/unit/curve.test.js` | the reviewer's mutation fails both tests | #175 |
| #190 | CR (finding 2): plots README `kind` bullet says `chromaticFocus` | forced (`index.d.ts:97`) | `packages/plots/README.md` | none: doc only | #175 |
| #191 | CR (finding 3): `sources_of` deleted, results as 2-tuples | forced (dead code, `workflow.md` Anti-patterns) | `scripts/record-phos-core.py` | re-run gives byte-identical fixtures | #175 |
| #192 | Backlog finding 9: recorder checks survive `-O`, args recorded, Cooke reference from the model | as the finding names; considered leaving 550 hard-coded (M2's diffraction curve reads it) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/*.json` | `phos-core-fixtures.test.js`: reference is one of the wavelengths | #191 |
| #193 | Backlog finding 10: MTF sources in source order | as the finding names | `tests/unit/phos-core-fixtures.test.js` | swapped sources fail | #192 |
| #194 | Backlog finding 4: aria-label escaped once | as the finding names | `packages/plots/src/curve.js` | `curve.test.js::aria-label escapes labels once` | #189 |
| #195 | Backlog finding 7: unknown kind, prototype keys included, draws chromatic focus | own-key lookup, as before the split | `packages/plots/src/curve.js` | `curve.test.js::unknown kind draws chromatic focus` | #194 |
| #196 | Backlog finding 5: caller ticks print exactly at a shared precision | the smallest d with every tick exact at `toFixed(d)`, because the finding's step rule mislabels 0, 1.5, 3 as 0, 2, 3 (sent back); considered parsing `e-` (misses 0.30000000000000004) | `packages/plots/src/curve.js` | `curve.test.js::caller ticks in exponent notation keep their decimals` | #195 |
| #197 | Backlog finding 8: points and M to 9 significant digits | `toPrecision(9)`; considered unrounded floats (longer markup, no gain) | `packages/plots/src/curve.js` | `curve.test.js::tiny and huge ranges round-trip within 0.5 px` | #196 |
| #198 | Backlog finding 11: comments name the split modules | as the finding names | `packages/plots/src/common.js`, `tests/glass-fills.spec.js` | none: comments only | #175 |
| #200 | Review M1 round 2 findings 1 and 4: caller ticks coerced with `Number`, a purely relative tolerance | as the findings name; considered typing ticks as numbers only (#178 types them; JSON callers still send strings) | `packages/plots/src/curve.js` | `curve.test.js`: sub-1e-9 sets and string ticks | #198 |
| #201 | Round 2 finding 2: points and M written unrounded (shortest round-trip), replacing #197's 9 significant digits | exact values keep the group in data coordinates (U6, ADR-0001); considered offsets from the range start (sent back: inverting the transform would no longer give the data) and toPrecision(9) (1.2 px off at [1e6, 1e6+1]) | `packages/plots/src/curve.js` | `curve.test.js`: [1e6, 1e6+1] within 0.5 px | #200 |
| #202 | Round 2 finding 3: `hasOwnProperty.call` instead of `Object.hasOwn` | forced (`packages/plots/build.mjs`: es2017 target, no polyfills) | `packages/plots/src/curve.js` | `curve.test.js`: no `Object.hasOwn(` in the built bundle | #201 |
| #203 | Round 2 finding 6: fixtures record parsed args with paths replaced | as the finding names | `scripts/record-phos-core.py` | re-run with `--phos=<path>` is byte-identical | #198 |
| #204 | CR (review M1 round 3 finding 1): point values converted with `+v` before printing | numbers can't carry markup; considered `esc()` on each value (keeps non-numbers in a numeric attribute) | `packages/plots/src/curve.js` | `curve.test.js::string point values cannot inject markup` | #203 |
| #205 | Round 3 finding 2: axis ranges coerced to numbers | as #200 does for ticks | `packages/plots/src/curve.js` | `curve.test.js::string ranges draw as numbers` | #204 |
| #206 | CR (review M1 round 4 finding 1): `niceTicks` bounded on spans of a few ulps or below 1e-100 | return `[lo, hi]` when the step or count is out of bounds, because the loop counter stops advancing past 2^53; considered capping the loop count only (still allocates up to the cap, and labels repeat) | `packages/plots/src/axis.js` | `axis.test.js::spans of a few ulps or below 1e-100 return promptly` | #205 |

### M2: Field curvature, distortion and the typed API GitHub: `P162 M2: Field curvature, distortion and the typed API`

Demo: `npm run gallery`: the field curvature and distortion tiles come from the recorded achromat, and MTF has
its diffraction limit again. The remaining sample tiles draw through one predicate. `npm run test:unit`:
`tests/types/curve.ts` type-checks a typed call. Proves: O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #209 | CR (user, M1 demo): every curve role draws a 1 px stroke | 1 px non-scaling, like layout2D's rays, because the user chose it at the demo (user); considered 1.5 px as built and px-space drawing (ADR-0001's alternative) | `packages/plots/src/curve.js`, `packages/plots/README.md` | `curve.test.js::every role draws a 1 px stroke` | M1 |
| #176 | O3 acceptance test, skipped | forced (`workflow.md`, TDD) | `tests/unit/curve.test.js` | `::recorded field curvature and distortion round trip (U6)`, skipped | M1 |
| #177 | `mtfDiffraction(nu, lambda, N)` in physics, ν in cycles/mm and λ in mm | the closed form `2/π(φ − cos φ sin φ)`, φ = acos(ν/ν_c), ν_c = 1/(λN), because the caller needs the reference curve phos-core doesn't return; considered recording the sample's `mtf.diff` (it fits one lens only) | `packages/plots/src/physics.js`, `packages/plots/src/physics.d.ts`, `tests/unit/physics.test.js` | `physics.test.js::mtfDiffraction closed form` (1 at 0, 0 at cutoff, 0.3910 at half) | #176 |
| #210 | CR (#177's worker): the plots README's Physics helpers section shows `mtfDiffraction` | forced (stale doc: `packages/plots/README.md:96-105`) | `packages/plots/README.md` | none: doc only | #177 |
| #178 | Typed API in `index.d.ts`: `CurveSeries`, `CurveAxis`, `CurvePlotProps` with `series`/`x`/`y` alongside `kind`; `CurvePlot.svelte`'s header comment and the plots-svelte README's `CurvePlot` entry gain a typed example | forced (CLAUDE.md Core: `index.d.ts` is the public API's types; roadmap Constraints: typed API alongside the old) | `packages/plots/src/index.d.ts`, `tests/types/curve.ts`, `tests/unit/types.test.js`, `packages/plots-svelte/src/lib/CurvePlot.svelte`, `packages/plots-svelte/README.md` | `types.test.js::curve typed series type-check under --strict` | #176 |
| #179 | Gallery field curvature and distortion from the recorded achromat (y = recorded field angle), and MTF's diffraction series | the adapters in `tests/fixtures/phos-core/adapters.js`, because U11 keeps phos-core adapters out of `packages/`; considered adapters in `packages/plots` (U11 cut). The two tiles join `ownData` | `gallery/index.html`, `tests/fixtures/phos-core/adapters.js`, `tests/gallery.spec.js` | `gallery.spec.js::a missing sample script blanks only the sample tiles` updated; O3 covers the points | #177, #176 |
| #211 | CR (orchestrator, #179's check): field curvature and distortion recorded over 11 field angles | `set_sources` with an even sweep, because 3 sources draw two straight segments and the sample itself has 11 rows; considered interpolating in the adapter (invents data) | `scripts/record-phos-core.py`, `tests/fixtures/phos-core/*-field-curvature.json`, `*-distortion.json` | `phos-core-fixtures.test.js::field curvature and distortion sweep 11 fields` | #179 |
| #212 | CR (orchestrator, #179's check): curve keeps room for its last x tick label | grow the right margin to half the label's estimated width (6 px a character, as layout2D); considered anchoring the last label `end` (moves it off its tick) | `packages/plots/src/curve.js` | `curve.test.js::x tick labels stay inside the viewBox` | #179 |
| #213 | CR (orchestrator, after #211): the adapters use curve's default axes | curve's nice range and ticks, because the adapters carried a second copy of the tick rule and 11 y labels; considered keeping their own ticks (two rules to keep in step) | `tests/fixtures/phos-core/adapters.js` | O3 run unskipped locally; gallery green | #212 |
| #137 reuse | One predicate in `draw()` instead of the `sampleTile` wraps: tiles carry their own data | as #137 proposes, because #174 and #179 moved three tiles off the sample and the wraps no longer fit; considered leaving them, which keeps two ways of blanking a tile | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::a missing sample script blanks only the sample tiles` stays green | #179 |
| #180 | Unskip O3 | forced (`workflow.md`, TDD) | `tests/unit/curve.test.js` | O3 | all above |
| #214 | CR (review M2 round 1 finding 1): fixtures README describes the 11-field sweep | forced (stale doc since #211) | `tests/fixtures/phos-core/README.md` | none: doc only | #180 |
| #215 | CR (finding 2): `curve.ts` type-checked once | as the finding names | `tests/unit/types.test.js` | both type tests pass | #180 |
| #216 | CR (finding 3): curve.test.js imports the merged ELEO from `index.js` | as the finding names | `tests/unit/curve.test.js` | 15/15 pass | #180 |
| #217 | CR (finding 4): adapters call `ELEO.mtfDiffraction` inline | the gallery already blanks only the MTF tile on failure; considered the named re-throw (no reader needs it) | `tests/fixtures/phos-core/adapters.js` | curve and gallery tests pass | #180 |
| #218 | Backlog finding 6: right margin from the rightmost shown tick | as the finding names | `packages/plots/src/curve.js` | `curve.test.js::x tick labels stay inside the viewBox` with `[10000, 0]` | #180 |
| #219 | Backlog finding 7: root README's physics list complete | as the finding names | `README.md` | none: doc only | #180 |
| #220 | Backlog (review M2 round 2 finding 1): curve.test.js comments match the adapters | as the finding names | `tests/unit/curve.test.js` | 15/15 | #219 |
| #221 | Finding 2: fixtures README names `workingFNumber` | as the finding names | `tests/fixtures/phos-core/README.md` | none: doc only | #219 |
| #222 | Finding 3: every recorded tile blanks alone on a missing fixture | loop the existing test, as the finding names | `tests/gallery.spec.js` | the looped test | #219 |
| #223 | Finding 4: one `fieldAnglesDeg` per document in the recorder | as the finding names, keeping fixtures byte-identical | `scripts/record-phos-core.py` | re-run, no fixture diff | #219 |
| #224 | Finding 5: the MTF tile reads `REC.mtf` | as the finding names | `gallery/index.html` | markup identical, gallery green | #219 |
| #225 | Backlog (review M2 round 3 finding 1): `tests/types/curve.ts` names its oracle | forced (`workflow.md`, TDD > Oracles) | `tests/types/curve.ts` | types.test.js passes | #224 |

### M3: The rule enforced and the release planned GitHub: `P162 M3: The rule enforced and the release`

Demo: `npm run test:unit`: the style lint passes with its exemptions listed, legends render under SSR with no
sample, and the changeset plans a plots minor. `PERF=1 npx playwright test tests/perf.spec.js` prints `curve`'s
median redraw, which the orchestrator writes into the Change log. Proves: O4, O5, O6

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #181 | O4, O5, O6 acceptance tests, skipped | forced (`workflow.md`, TDD) | `tests/unit/style-lint.test.js`, `tests/unit/legend.test.js`, `tests/unit/release.test.js` | the four tests in Outcomes, skipped | M2 |
| #121 reuse | `legend` without the sample: `n` index keys without values, none without `n`; `index.d.ts`'s `legend` comment and the plots README say so | guard the null sample in `legend.js`, as #121 proposes, because typed legends are H's; considered throwing a named error (SSR would still fail) | `packages/plots/src/legend.js`, `packages/plots/src/index.d.ts`, `tests/unit/legend.test.js`, `packages/plots/README.md` | O5 | #181 |
| #182 | The style lint (U5) | a regex scan of comment-stripped sources with an explicit exemption list (file + name), because U5's oracle is a unit test; considered an ESLint `no-restricted-syntax` rule (a new dev dependency, the user's call) | `tests/unit/style-lint.test.js` | O4. Stop: a match outside the listed exemptions is reported, not exempted | #181 |
| #183 | U14 measurement for `curve`: 20 series of 200 points, median of 20 redraws | a Playwright test that reads `performance.now()` in the gallery page and skips unless `PERF=1`, because U14's oracle names it and it is not a gate; considered a Node benchmark (U14 names headless Chromium). Stop: a median over 16 ms is reported (kill criterion D–J / U14), not fixed | `tests/perf.spec.js` | `perf.spec.js::curve redraw (U14)` | #181 |
| #184 | Changeset: plots minor | forced (CLAUDE.md: a changeset per user-facing change; roadmap Constraints: minors until J) | `.changeset/curve-typed.md`, `tests/unit/release.test.js` | O6 | #181 |
| #185 | Unskip O4, O5, O6 | forced (`workflow.md`, TDD) | `tests/unit/style-lint.test.js`, `tests/unit/legend.test.js`, `tests/unit/release.test.js` | O4, O5, O6 | all above |
## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| phos-core's cdylib won't build locally (Postgres, diesel, toolchain) | no recorded fixtures, so O1 and O3 can't pass | #169's stop condition; escalate before working around it (the user decides between the REST server, a CI artifact, or a pivot) |
| `from_lens_table` can't express the sample achromat | the achromat fixtures are missing | #169's efl check; the Cooke triplet alone still proves O1 (escalate: drop the achromat from U6's oracle is the user's) |
| `curve`'s transform group changes the look (dashes under a non-scaling stroke at an anisotropic scale, about 1:−210 for MTF; line joins) | kill criterion D–J fires | M1 demo by eye against main's screenshots; ADR-0001 records the px-space alternative to fall back on, which changes U6's oracle wording (the user's) |
| The split pulls `renderers.js` into `eleo-layout.js` | size test fails | `layout-size.test.js` in every gate; `layout2d.js` imports only `common.js` |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-08 headless: scope from roadmap row D, absorbing #121 and #137 as the roadmap pick named (row: Choose, add or reorder rows).
- 2026-10-08: critique (general-purpose, claude-fable-5-1). Rejected: 21 (keeping `fmt`/`css` in `renderers.js` would make the renderer modules import it back, a cycle) and 25 in part (the transform group stays, because U6's oracle names a transform; the px-space alternative goes into ADR-0001 and Risks). 32's merge of #167 and #168 rejected: together they would be six files. Applied: 1–20, 22–24, 26–31 and the rest of 32: #167 and #168 moved into M1 so O2 holds at M1; the curve item split in two (#172, #173); `curve`'s baseline entries are deleted, not re-recorded; field angles and polychromatic MTF recorded; `MaterialSpec.CATALOG`; `ELEO.sample` getter; the `legend` count without `n`; the `physics.js` exemption; `PERF=1` with a stop at 16 ms; the baseline screenshot command; O6 a plots minor only; `adapters.js` a classic script; docs in #121 and #178; `niceTicks` returns decimals; a zero line rule; `hollow` and `marker` in `color.js`; units for `mtfDiffraction`.
- 2026-10-08 (user): the new oracles of O2, O5 and O6 approved as written. O1, O3 and O4 reuse the roadmap's U6 and U5.
- 2026-10-08 headless: plan approved (row: Choose, add or reorder rows).
- 2026-10-08 CR #187 (accepted, orchestrator: a non-Core doc): `README.md:65` names `renderers.js` for "the rest"; work item #188 rewrites it after #168.
- 2026-10-08 review M1 round 1: 3 blocking (CRs #189, #190, #191, accepted by the orchestrator: none changes an invariant, outcome or oracle; #189 strengthens O1's assertion to its stated oracle). Backlog into M1: #192–#198 (headless: backlog into M1, row: milestone acceptance within the plan). #199 stays a plain issue (`idx` is in `common.js`, which ships in `eleo-layout.js`).
- 2026-10-08 review M1 round 2: 0 blocking. Backlog into M1: #200 (findings 1, 4), #201, #202, #203 (headless: backlog into M1, row: milestone acceptance within the plan). Finding 5 (the `kind` tiles' uniform tick decimals) is named at the M1 demo.
- 2026-10-08 review M1 round 3: 1 blocking, new in #201 (CR #204, accepted by the orchestrator: a fix in the item's file that keeps every invariant). Backlog #205 into M1 (headless: backlog into M1, row: milestone acceptance within the plan). Later backlog stays plain issues.
- 2026-10-08 review M1 round 4: 1 blocking, missed by rounds 1–3 (CR #206, accepted by the orchestrator: a fix in `axis.js` that keeps every invariant). Backlog #207 stays a plain issue (after round 3).
- 2026-10-09 (user, M1 demo): go. ADR-0001 accepted with a Verdict. Curve strokes 1 px non-scaling at every size (CR #209, into M2 as its first item); uniform tick decimals on field curvature and distortion accepted; the gallery diff (only the four curve tiles changed) approved as the U5–U10 baseline for row D.
- 2026-10-09: M1 done. CI `test` green on fe2b61a; review M1 round 5: 0 blocking.
- 2026-10-09 CR #210 (accepted, orchestrator: a non-Core doc): the plots README's physics section gains `mtfDiffraction`. #184's changeset names it.
- 2026-10-09 CRs #211 (dense field sweep for field curvature and distortion) and #212 (room for the last x tick label), accepted by the orchestrator from #179's gallery check: data resolution and a look fix inside the plan, outcomes and oracles unchanged.
- 2026-10-09 CR #213 (orchestrator): the phos-core adapters drop their own tick rule for curve's defaults.
- 2026-10-09 review M2 round 1: 4 blocking (CRs #214–#217, accepted by the orchestrator: docs and smaller versions inside the milestone's files). Backlog #218, #219 into M2 (headless: backlog into M2, row: milestone acceptance within the plan); finding 5 (`CurvePlotProps` became a union) goes into #184's changeset.
- 2026-10-09 review M2 round 2: 0 blocking. Backlog #220–#224 into M2 (headless: backlog into M2, row: milestone acceptance within the plan).
- 2026-10-09 review M2 round 3: 0 blocking. Backlog #225 into M2 (headless: backlog into M2, row: milestone acceptance within the plan); #226 stays a plain issue.
- 2026-10-09 (user, M2 demo): go. The sample's distortion (−0.1 % with a step at 0.2°) disagrees with phos-core's (−0.0038 % at 2°): ignored, the legacy path goes in row J.
- 2026-10-09: M2 done. CI `test` green on b904732; review M2 round 4: 0 blocking.
