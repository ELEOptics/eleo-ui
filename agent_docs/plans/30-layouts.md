# Plan #30: General layout2D, standalone entry, release

Status: approved 2026-10-05
Branch: `plan/30-layouts` PR: #42 Depends on: plan #4 (done) Roadmap: `agent_docs/roadmap.md`, row B

## Problem

`layout2D` can only draw the sample achromat. eleoptics.com draws any recorded sequential system with
its own `layout.js`, and ELEOptics/eleo-website's Switch row wants to delete that copy and use ours. Both
rows A and B ship in a single minor release. The release setup is broken today: #21 would publish
`plots-svelte` as 1.0.0.

## Ground truth

What's here today:

- `layout2D` (`packages/plots/src/renderers.js:43-73`) is hard-coded to the sample:

  - it draws three spherical `profiles` as arcs, with crown on surfaces 0–1 and flint on 1–2;
  - `ym = 13.5`, `zmin = -8`;
  - the chief ray is index 3;
  - STO and IMA are labelled at fixed heights.

  It returns an SVG string with viewBox-pixel coordinates (`toFixed(2)`) and no transform. Its options are `data`, `colorBy` (`field` | `wavelength`, the latter drawing `layoutWl.rays`), `rays` (`marginal-chief` | `fan` | `chief`) and `width`.

- `renderers.js` is one closure (`const ELEO = (function(){…})()`). Every renderer shares `idx()`, `svg()`, `NS` and `STANDARD` from it.

- Classic-script builds are `eleo-plots.js` (everything), `eleo-plots-sample.js` and `eleo-physics.js`. They come from `build.mjs`, are IIFEs that each add to `window.ELEO`, and are exported from `package.json`.

- The sample data is in `sample.json`:

  - `profiles` has 3 entries of {z, R, sd, ys[41], zs[41]};
  - `layout` has 3 fields × 7 rays × 5 [z, y] points, the first at z = −10;
  - `layoutWl` is {field, rays: 3 wavelengths × 7};
  - `zimg` is the image z.

  `layout3D` reads `profiles` and `rays3d`, not `layout`.

- Svelte wrapper: `packages/plots-svelte/src/lib/Layout2D.svelte` passes its props through. The types are `Layout2DProps` in `index.d.ts:6`.

- Gallery tiles: `layout2D` and `layout2D-fan` (`gallery/index.html:39-40,71-72`). `tests/gallery.spec.js` expects 15 tiles that all draw.

- Unit tests run under `node --test` and import `src/*.js` directly. `layout2D` returns a string, so it can be tested without a DOM.

What the website does (ELEOptics/eleo-website, `public/layout.js`, 78 lines; `scripts/layout.py`):

- The recorded format, in mm, YZ section:

  - `{surfaces: [{z, sd, stop, image, glass: null|"crown"|"flint", profile: [[z, y] × 41]}], rays: [field][ray][[z, y]…]}`;
  - `glass` is the material after the surface;
  - profiles run to the lens's shared edge semi-diameter;
  - each ray starts 12 mm before surface 1, and dead rays are dropped (one fan has 5 rays).

- Five recorded layouts:

  - the Cooke triplet twice, 7 surfaces;
  - a singlet three times, 4 surfaces, with a standalone stop at z = 0;
  - they live in `public/phos-core-runs.js` and `public/services-tool.js`.

- `bounds(layouts)` returns the box `{zmin, zmax, ylo, yhi}`:

  - z comes from the rays only;
  - y covers 0, the rays and each surface but the image: a lens reaches |profile[0][1]|, a standalone stop sd + 2.5 (corrected by #51);
  - 4% padding in y.

- `draw(L, labels, box)` draws, in order:

  - an axis;
  - one glass polygon per lens (this profile + the next one reversed);
  - a standalone stop as two ticks;
  - every ray of each fan in `.f0–.f2`;
  - each field's label at the image end of the middle ray;
  - the image plane, spanning ±(ray reach + 1.5);
  - a 10 mm scale bar.

  It has a fixed width of 480 and coordinates at `toFixed(1)` (≈0.03 mm). The website shares one `box` between `merit.layout_before` and `layout_after`.

- The website loads it as a classic script. Today it loads only `eleo-physics.js` from us. Its Switch row says "the pages' added script weight is stated in the PR and accepted by the user".

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 (U3) | `layout2D` draws any recorded layout, and the sample is one | given each of the 5 website fixtures and the converted sample, when `layout2D({data})` runs, then inverting the SVG group's `transform` recovers each glass profile (from the polygons), each standalone stop (tick ends), each image plane (its z) and every ray (polylines) within 0.01 mm | `fixture: the website's layouts recorded by its scripts/layout.py (eleo-website@39d19e4), plus the sample; inverting each SVG's transform recovers every surface profile and ray within 0.01 mm` (approved, U3) | `tests/unit/layout2d.test.js::recorded layouts round-trip` |
| O2 (U3) | Layouts drawn with one `box` share a scale, and fields are labelled at the image | given merit `before` and `after`, when both are drawn with `box: layoutBounds([before, after])`, then their transforms are equal and each `labels[k]` sits at the image end of fan k's middle ray | `property: one box → one transform; metamorphic: a layout alone vs in a shared box differs only by the box` | `tests/unit/layout2d.test.js::shared box` |
| O3 (U4) | `eleo-layout.js` loads alone and draws | given a page with only `tokens.css` and `dist/eleo-layout.js`, when it draws every O1 fixture, then there are no errors, every layout has marks, and `window.ELEO` has `layout2D` and `layoutBounds` but no `sample` | `property: the entry loads in a page with no other ELEO script and draws U3's fixtures` (approved, U4) | `tests/gallery.spec.js::standalone layout entry` |
| O4 | The release plans a minor for plots and a patch for plots-svelte | given a temp workspace with the real names, versions, peer range and `.changeset/config.json`, and one `plots: minor` changeset, when `changeset status --output` runs, then `plots-svelte` is a patch, not a major; and the branch's `.changeset/layouts.md` asks for exactly that. (`npm audit` 0 is #28's stop condition and a demo line, not a test.) | `spec: semver (plots-svelte's widened peer range still admits the new plots, so a patch), reproduced as in #21` | `tests/unit/release.test.js` |

The gallery keeps every tile drawing, with no change apart from U1's colors. This is checked by the existing `gallery.spec.js` and by the user at the M1 demo (U3's design baseline).

## Non-goals

- A shared line chart, histogram, sensitivity bars and `fmt` units: not on this roadmap (the website keeps its own).
- Matching the site's `layout.js` look pixel for pixel. The library look stays, and options cover the site's needs (round 1, user). The site re-baselines at Switch.
- Accepting the old `data.layout` rays-array shape: it would be a special case, the one the kill criterion warns about. The change is a breaking minor, stated in the changeset (round 2, user).
- `layout3D` on the recorded format: it reads `profiles` and `rays3d`, which are unchanged. Next roadmap, if Phos needs it.
- `chief` recorded by the site's `layout.py`: a website change, filed there at publish and cited from Switch (round 2, user).
- A size-budget test for `eleo-layout.js`: the size is stated in the README and PR instead (round 2, user).
- Merging the Version Packages PR and publishing: the user does that after this PR merges. It is the row's exit, not this plan's.

## Existing issues

| Issue | Bucket | Where |
| -- | -- | -- |
| #3 | absorb | the row's issue: O1 to O3 |
| #21 | absorb, reuse | M3 |
| #28 | absorb, reuse | M3 |
| #27 | absorb, reuse | M3: the same "theme change" → "theme or palette change" edit in `renderers.js:3`, `index.js:3`, `index.d.ts:2`, `packages/plots/README.md:21` and `Layout3D.svelte:1` |

## Constraints and assumptions

- The format is the site's `layout.py` output, plus an optional `chief: number[]` (one ray index per fan; round 1, user). Without `chief`, the chief is the fan's middle ray `floor(n/2)`. That is the site's rule, and it can be wrong for a vignetted fan.
- `data` is either a recorded layout (it has `surfaces`) or a system whose `layout` (field-colored) and `layoutWl` (wavelength-colored) are recorded layouts (round 1, user). `Layout2D.svelte` spreads its props into `layout2D`, so the Svelte wrapper needs no code change, only its README example.
- Geometry (glass, axis, stop, image, rays) is drawn in mm inside one `<g transform="matrix(s 0 0 −s tx ty)">`, with points at `toFixed(3)` mm. Strokes keep `vector-effect="non-scaling-stroke"`. Text, the chief dot and the scale bar sit outside the group, in viewBox px. Dash arrays stay in px, as today: under `non-scaling-stroke` the browser applies them in screen space (CR #48).
- What "recovers" means in O1, per surface kind:
  - glass profiles: from the polygons, exact to `toFixed(3)` (≤ 0.0005 mm);
  - a standalone stop: from its tick ends at ±sd and ±(sd + 2.5);
  - the image: from its line's z;
  - rays: from the polylines.
- Without a `box`, `layout2D` uses `layoutBounds([layout])`, a port of the site's `bounds()`:
  - z covers the rays;
  - y covers the rays and the surface edges, padded 4%.
- `eleo-layout.js` holds `layout2D` and `layoutBounds` only, with no sample. It adds to `window.ELEO`, the same pattern as `eleo-physics.js` (round 2, user). It colors through `idx()` (`var(--series-k, var(--field-…))`), so it works with `tokens.css` alone.
- Every commit passes `scripts/check-tests-touched.sh`: an item that changes `packages/*/src/` also changes a file under `tests/`.
- `npm audit` stays out of the tests: it needs the registry, and its answer changes when advisories are published. It is #28's stop condition and a demo line.
- The changes to `package.json`, `package-lock.json` and `.changeset/config.json` are security triggers, so the PR merges by hand.

## Decisions

There are no ADRs: every choice here is reversible inside 0.x. There are no core changes: the Core line in `CLAUDE.md` is still a placeholder.

- For the roadmap: propose `packages/plots/src/index.d.ts` and the `exports` in `package.json` as Core, since this plan's API break is the kind of change Core should gate.

Public API added:

- `layoutBounds(layouts) → box`, on both the ES entry and `window.ELEO`;
- the `layout2D` options `box`, `labels` and `marks`;
- the types `RecordedLayout`, `RecordedSurface` and `LayoutBox`;
- the `./eleo-layout.js` export.

Changed: the shape of `data.layout` and `data.layoutWl` (a breaking change; round 2, user).

## Milestones

### M1 (done 2026-10-06): layout2D draws recorded layouts. GitHub: `P30 M1: layout2D on the recorded format`

Demo:

- `npm run gallery`: the two layout2D tiles, unchanged apart from U1's colors and a shorter image line with its labels (accepted 2026-10-06) (their framing is pinned with a `box`), in both themes and all three palettes. This is U3's design baseline.
- `npm run test:unit`: O1 round-trips 6 layouts, the 5 site fixtures and the sample.

Proves: O1. The kill criterion is decided in the last item: converting the sample has to delete the old path, not add a special case.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #44 | From CR #43: `TEST_RE` counts test files by suffix, so data under `tests/fixtures/` needs no `oracle:` line | forced (CR #43: JSON can't carry a comment line); considered an `oracle` key inside each fixture, ruled out because the hook reads comment lines and the fixtures are the site's data verbatim | `scripts/workflow.env` | the hook on a staged fixture: red, then green; a test file without an oracle line still fails | |
| #31 | O1 acceptance test, skipped; the 5 site layouts as fixtures, with their extraction script | forced (`workflow.md`, TDD: the first item writes them skipped). The fixtures come from a committed `extract.mjs`, which reads `public/phos-core-runs.js` and `public/services-tool.js` at eleo-website@39d19e4 (the commit is recorded in the README); considered fetching them at test time, ruled out because the gate would then depend on another repo | `tests/unit/layout2d.test.js`, `tests/fixtures/layouts/` (`*.json`, `extract.mjs`, `README.md`) | `layout2d.test.js::recorded layouts round-trip` (skipped) || #44 |
| #32 | `src/layout2d.js` draws `data.surfaces` layouts: glass polygons, the axis, ticks for a standalone stop, the image, the `rays` option over `chief` or the middle ray, the chief dot, STO and IMA marks, `layoutBounds` (used, not yet exported) and the `box` option (`o.box || layoutBounds([L])`). Shared `STANDARD`, `idx`, `svg` and `NS` move to `src/common.js`. `renderers.js` delegates to it when `data` has `surfaces` and keeps its old path for the sample. #27's `renderers.js:3` line rides along | its own module because M3 bundles it alone; considered editing it inside the `renderers.js` closure, ruled out because then it can't be bundled without every renderer. `common.js` because two copies of the field order would drift; `field-order.test.js` imports `STANDARD` from it, so the test guards the single source | `src/layout2d.js`, `src/common.js`, `src/renderers.js`; `tests/unit/field-order.test.js` (import) | `layout2d.test.js::triplet draws 3 polygons, no stop ticks`, `::singlet draws 1 polygon and 2 ticks`, `::chief index picks the dot` (unskipped, synthetic 5-ray fan) | #31 |
| #46 | From CR #45: `README.md`'s "A renderer" line names `layout2d.js` and `common.js` | forced (CR #45: stale doc after #32) | `README.md` | the named paths exist | #32 |
| #33 | Sample: `layout` and `layoutWl` become recorded layouts. Surfaces come from `profiles` ys/zs, crown then flint; `stop: true` goes on surface 0; the image is at `zimg`, with `sd` = the largest \|y\| of the rays there and `profile` = `[[zimg, y] × 41]`; no `chief` (7-ray fans, middle = 3). Deletes `renderers.js`'s old path. The two gallery sample tiles pin `box: {zmin: -8, zmax: zimg + 4, ylo: -13.5, yhi: 13.5}`, today's framing (user, at approval). Unskips O1 | a one-off conversion by `scripts/sample-layout.mjs`, committed, because the sample is static data; considered converting at load in `sample.js`, ruled out because that is the special case the kill criterion names | `src/sample.json`, `src/renderers.js`, `scripts/sample-layout.mjs`, `gallery/index.html`; `tests/unit/layout2d.test.js` (unskip) | O1 green; `::sample surfaces equal its profiles` (oracle: the sample's own `profiles`); `field-order.test.js` still green | #32 |
| #49 | From CR #48: dash arrays in px (`4 6` axis, `6 4` chief); `dash()` deleted | forced (CR #48: non-scaling-stroke dashes in screen space) | `packages/plots/src/layout2d.js` | dash-array test asserts `4 6` / `6 4` | #33 |
| #50 | Review finding 2: the sample test's oracle line names its kind | forced (hook: every `oracle:` line in a new file has a kind) | `tests/unit/layout2d.test.js` | `check-tests-touched.sh 42d355f..HEAD` passes | #33 |
| #51 | Review finding 3: `layoutBounds` ports the site's `bounds()` (skip the image, reach `\|profile[0][1]\|`); the image line is clamped to the box | the plan says port, because the site's two-layout figures depend on its framing; considered amending the plan to keep ours, ruled out because it's 41% taller on the triplet | `packages/plots/src/layout2d.js` | `::layoutBounds ports the site` (reference: the site's function) | #49 |
| #52 | Review finding 5: an old-shape layout throws a named error; an empty fan is skipped | one guard and one skip, because the format allows an all-dead fan; considered validating `box` too, which waits for M2 when `box` goes public | `packages/plots/src/layout2d.js` | `::old shape is named`, `::empty fan is skipped` | #51 |
| #54 | Review round 2 finding 1: STO label above a lens stop's profile edge (`reach()` uses `\|profile[0][1]\|`) | the same edge rule as `layoutBounds`, because the label must clear the glass it names; considered moving the label only, which leaves two edge rules | `packages/plots/src/layout2d.js` | `::STO label above the stop's edge` | #52 |
| #55 | Review round 2 findings 2-3: out-of-range `chief` and a layout with no rays throw named errors | named errors like #52's, because bare TypeErrors and NaN drawings hide the cause; considered falling back to the middle ray, which hides a bad recording | `packages/plots/src/layout2d.js` | `::out-of-range chief is named`, `::no rays is named` | #54 |
| #56 | Review round 2 finding 4: `recorded()` is not exported | forced (no caller outside the module; the plan's Public API doesn't list it) | `packages/plots/src/layout2d.js` | `::layout2d.js exports layout2D and layoutBounds only` | #55 |
| #57 | Review round 3 finding 1: STO label clears the glass for any box | room reserved above the geometry because a constant clamp fails a box whose top is near the stop's reach; considered clamping per label only | `packages/plots/src/layout2d.js` | `::STO label above the stop's edge` over fixtures, sample and the pinned box | #56 |
| #58 | Review round 3 finding 3: a fan that is not an array is named | named like #52/#55; considered leaving it, since layout.py never emits one | `packages/plots/src/layout2d.js` | `::a fan that is not an array is named` | #57 |
| #59 | Review round 3 finding 5: `recorded()` inlined; the test imports the module once | forced (one caller; refactor under the existing tests) | `packages/plots/src/layout2d.js` | existing tests stay green | #58 |
| #53 | Review finding 6: README lists `NS` among common.js's helpers | forced (stale doc) | `README.md` | the list matches common.js's exports | #46 |

### M2: shared box and labels, typed and documented. GitHub: `P30 M2: shared box, labels, types`

Demo:

- A new gallery tile, `layout2D-shared`, draws the merit singlet before and after at one scale, with the fields labelled 0°, 12° and 24° at the image.
- The invocation: `layout2D({ data: before, box: layoutBounds([before, after]), labels: ['0°','12°','24°'], marks: false })` returns one `<svg>` whose `<g transform="matrix(s 0 0 -s tx ty)">` is identical for both drawings.
- `npm run check` type-checks the new props.

Proves: O2.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #34 | O2 acceptance test, skipped | forced (`workflow.md`, TDD) | `tests/unit/layout2d.test.js` | `::shared box` (skipped) | M1 (#33) |
| #35 | `box` made public: `layoutBounds` is exported from `index.js` and assigned onto the default `ELEO`, so `eleo-plots.js` has it too. Typed: `LayoutBox`, `RecordedLayout`, `RecordedSurface`, `Layout2DProps.box`, `data: RecordedLayout \| system`. #27's `index.js:3` and `index.d.ts:2` lines ride along | a port of the site's `bounds()`, because the site's two-layout figures depend on its framing; considered a `scale` option, ruled out because a scale alone doesn't line up the z origins of two drawings. Typed as built, because a types-only item can't pass the hook | `src/layout2d.js`, `src/index.js`, `src/index.d.ts` | `::box pins the transform` (unskipped), `npm run check` | #34 |
| #36 | `labels` (text at the image end of each fan's chief) and `marks: false` (drops STO and IMA), both typed | two options, because the site wants labels and no marks while the gallery wants marks and no labels (round 1, user); considered `marks` turning off whenever `labels` is set, ruled out because a page could want both | `src/layout2d.js`, `src/index.d.ts` | `::labels at the image`, `::marks off` | #35 |
| #37 | The `layout2D-shared` gallery tile fetches `/tests/fixtures/layouts/merit-*.json` before drawing; `data-ready` moves after the awaited draw; the gallery test counts 16 tiles | the demo for O2, because the eye checks the shared scale; considered relying on the unit test alone, ruled out because the M2 demo needs a picture | `gallery/index.html`, `tests/gallery.spec.js` | `gallery.spec.js::gallery renders every tile` (16) | #36 |
| #38 | READMEs: the recorded format, `box`, `labels`, `marks`, `layoutBounds`, the chief rule and the migration line; the plots-svelte example. Unskips O2 | forced (`workflow.md`, Docs: user-visible behaviour, documented by its owner; TDD: the last item unskips) | `packages/plots/README.md`, `packages/plots-svelte/README.md`; `tests/unit/layout2d.test.js` (unskip) | O2 green | #34 to #37 |

### M3: standalone entry and a release that plans right. GitHub: `P30 M3: eleo-layout.js and release`

Demo:

- `npx playwright test -g "standalone"`: `tests/fixtures/standalone-layout.html` draws all 5 fixtures from `eleo-layout.js` alone.
- The README states the entry's size.
- `npx changeset status --verbose` on the branch shows `@eleoptics/plots` minor and `@eleoptics/plots-svelte` patch.
- `npm audit` shows 0 vulnerabilities.

Proves: O3, O4.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #39 | O3 and O4 acceptance tests, skipped. O4 runs `changeset status --output` in a temp git workspace: two minimal `package.json`s with the real names, versions and peer range, a copy of `.changeset/config.json`, and one `plots: minor` changeset. It asserts `plots-svelte` is not major | forced (`workflow.md`, TDD). A temp workspace because the live repo's `changeset status` needs `main` (absent in CI's shallow checkout) and fails once `.changeset/` is empty after a release, which would block `release.yml`; considered running it on the repo, ruled out for those reasons | `tests/gallery.spec.js`, `tests/unit/release.test.js` | `::standalone layout entry`, `release.test.js` (skipped) | M2 (#38) |
| #40 | `src/iife-layout.js`, its `build.mjs` entry and the `./eleo-layout.js` export. `standalone-layout.html` loads only `tokens.css` and the entry, fetches the fixtures, then sets `data-ready`. The plots README's "Without a bundler" section and the root README's script list gain it, with its size | forced (round 2, user: the same pattern as `eleo-physics.js`) | `src/iife-layout.js`, `build.mjs`, `package.json` (exports), `tests/fixtures/standalone-layout.html`, both READMEs | `::standalone layout entry` (unskipped here) | #39 |
| #21 reuse | Peers no longer force a major: `onlyUpdatePeerDependentsWhenOutOfRange` is set, and the plots-svelte peer becomes `>=0.1.0 <1` | forced (#21's verified fix) | `.changeset/config.json`, `packages/plots-svelte/package.json` | `release.test.js` (unskipped here) | #39 |
| #28 reuse | Bump `@changesets/cli`; add root `overrides` only if `npm audit` still reports. Re-check #21's option against the new config validator. The root README says `npm audit --omit=dev` is what ships | bump first because it removes rather than pins (round 2, user); considered overrides only | `package.json`, `package-lock.json`, root README line | `npm audit` 0 (stop condition); `release.test.js` still green | #21 |
| #41 | `.changeset/layouts.md`: plots minor, with the breaking `data.layout` shape and its migration; plots-svelte patch, naming the widened peer range. #27's last lines (`packages/plots/README.md:21`, `Layout3D.svelte:1`) | forced (`workflow.md`, TDD; the release needs a changeset). The #27 lines ride here because this item touches tests and the hook needs that | `.changeset/layouts.md`, `packages/plots/README.md`, `packages/plots-svelte/src/lib/Layout3D.svelte`; `tests/unit/release.test.js` (asserts the changeset's bump types) | O3, O4 green | #40, #21, #28 |

26 items in 3 milestones. The milestones are sequential. No other plan runs alongside this one.

## Risks and spikes

| Risk | Impact | Mitigation |
| -- | -- | -- |
| The sample needs a special case (kill criterion) | stop and ask: pivot, cut or continue | decided by M1's last item, which must delete the old path |
| The mm group changes how dashes and dots render | the tiles look off | dot outside the group, dashes in px (CR #48: px/s rendered solid); checked at the M1 demo in both themes |
| The bump to `@changesets/cli` 3.x drops or renames #21's option | #21's fix breaks | `release.test.js` runs on the bumped CLI; #28 comes after #21 |
| The bump changes how `changeset version` writes its output | the release PR looks different | a dry `changeset version` at the M3 demo, then reverted |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-05: draft, ground truth from eleo-ui@19f54aa and eleo-website@39d19e4.
- 2026-10-05 round 1 (user): absorb #3, #21, #27, #28. `data` is a recorded layout or a system carrying one, plus `layoutBounds`. Library look, with `labels` and `marks` for the site. An optional `chief` per fan, falling back to the middle ray.
- 2026-10-05 round 2 (user): a breaking minor, said in the changelog. `eleo-layout.js` holds `layout2D` and `layoutBounds`, with no budget test. #28: bump changesets first, overrides only if needed. File "record `chief`" on ELEOptics/eleo-website at publish, cited from Switch.
- 2026-10-05 critique (plan critic, claude-fable-5-1): applied findings 1 to 8 and 10 to 15, which brings the plan from 18 items to 13. The changes: the sample is converted after the new renderer exists, and the conversion deletes the old path; O4 runs in a temp workspace; items touching `packages/*/src/` also touch tests, so the hook passes; #27 is spread over the items that edit its files; the chief dot is drawn outside the mm group; O1 says per surface kind what it recovers; the sample's image surface rule is stated; the gallery fixture load is async; `layoutBounds` is written in M1; the root README is updated; a Core proposal goes to the roadmap. Finding 9 (framing) went to the user. Rejected: none.
- 2026-10-05 approval round (user): the gallery's sample tiles pin today's framing with a `box`, so the row's exit holds as written. The `box` option moves into M1.
- 2026-10-05: published. Plan issue #30, milestones P30 M1 to M3, work items #31 to #41 (#21 and #28 reused). #3 and #27 absorbed.
- 2026-10-05 headless: CR #43 accepted (keeps every invariant; row: Split, CR triage, commit order, wave dispatch). New item #44 in M1; #31 runs after it.
- 2026-10-06 headless: CR #45 accepted (stale doc, not Core; row: Split, CR triage, commit order, wave dispatch). New item #46 in M1.
- 2026-10-06 headless: M1 review round 1, 1 blocking. CR #48 accepted (dash arrays in px; it restores the look the Constraints line asked for, so every invariant is kept; row: Split, CR triage, commit order, wave dispatch); the Constraints line is corrected. Item #49.
- 2026-10-06 headless: backlog #50, #51, #52, #53 into M1 (row: milestone acceptance within the plan).
- 2026-10-06 (user): review finding 4 accepted: the sample's image line is ± the rays' reach at zimg (shorter than main's ±5 mm), with STO/IMA labels moved; logged as the exception to 'tiles unchanged' in the M1 demo line and row B's exit.
- 2026-10-06 headless: M1 review round 2, 0 blocking. Backlog #54, #55, #56 into M1 (row: milestone acceptance within the plan); finding 5 (stale demo image) re-captured at the demo.
- 2026-10-06 headless: M1 review round 3, 0 blocking. Backlog #57, #58, #59 into M1 (row: milestone acceptance within the plan); #60 (glass fallback, two fixes) stays a plain issue; finding 2 is #38's. Round 4's findings stay plain issues.
- 2026-10-06 headless: M1 review round 4, 0 blocking, nothing pulled in; #61 and #62 plain issues. M1 ticked; demo pending with the user.
