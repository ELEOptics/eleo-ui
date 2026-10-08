# Plan #144: Layout defaults for the website

Status: approved 2026-10-07
Branch: `plan/144-layout-defaults` PR: #<pr> Depends on: plan #90 (done) Roadmap: `agent_docs/roadmap.md`, row L

## Problem

eleoptics.com's switch to `layout2D` failed its M1 demo (ELEOptics/eleo-website#45, 2026-10-06). The user wants
new defaults for every consumer (#126): no dot at the chief ray's end, because it hides how the rays land at the
image; field labels just past the image plane; lighter rays; and a scale bar that reads "10 mm". The website's
plan is waiting on a release with them. Two bugs the website found are in the same code: the image line sits on
the viewBox edge (#117), and the scale label is unstyled without `plots.css` (#112).

## Ground truth

- `packages/plots/src/layout2d.js:109` draws a `<circle r="2.4">` at each fan's chief end, outside the mm group.
  Two tests find the chief through it (`tests/unit/layout2d.test.js:160-166`, `dotAt`; `:243`, "a chief dot per
  drawn fan").
- `layout2d.js:107`: rays use `style="stroke-width:var(--stroke-ray)"` under `vector-effect="non-scaling-stroke"`
  (`common.js:5`). `--stroke-ray` (`packages/tokens/src/tokens.json:663`) is used nowhere else in `packages/`.
- `layout2d.js:114-121`: a field label's baseline sits 5 px above its chief end (`above`). It is anchored `middle`,
  or `start`/`end` within 16 px of the left/right edge. The test `labels at the image` (`layout2d.test.js:382`)
  requires the anchor within 16 px of the chief end and inside the viewBox, with an `end` anchor near the right edge.
- `layout2d.js:83-86`: `s = W / (zmax - zmin)`, `tx = -zmin * s`. The box's z runs exactly from the first ray point
  to the last (`layoutBounds`). So the image line (`layout2d.js:112`, round-capped, `--stroke-curve`) is centred on
  the right edge, and ray caps poke past the left edge (#117). In y there is already 15 px of room above and
  27 px below.
- `layout2d.test.js:357-375`, `box pins the transform`, asserts `s = W / (zmax - zmin)`, `tx = -zmin·s` and
  `ty = 15 + yhi·s` (oracle: plan #30's transform). Padding and label room change `s` and `tx`.
- `index.d.ts:36` (Core) says "drawings with one box share a scale"; `packages/plots/README.md:41` and
  `packages/plots-svelte/README.md:28` say the same. With room sized by labels, that needs "the same box, width
  and labels".
- `scripts/check-tests-touched.sh` refuses a commit that changes `packages/*/src/` with no test file.
- `layout2d.js:131`: the scale text is `10 mm · true scale`. The IMA test finds it by `/true scale/`
  (`layout2d.test.js:423`).
- Every text `layout2D` draws has `class="eleo-tick"`, which only `plots.css:127` styles
  (`font: 400 10px var(--font-mono); fill: var(--ink-muted); font-variant-numeric: tabular-nums`). `layout2d.js`
  already puts `var()` in presentation attributes (`stroke="var(--ink)"`, `:99-100`).
  `tests/fixtures/standalone-layout.html` loads only `tokens.css` and `eleo-layout.js` (#112).
- `tests/unit/layout-size.test.js` caps `dist/eleo-layout.js` at a baseline plus 2 kB gzipped "per roadmap row".
  Its baseline (2338 B) was recorded at the start of row C.
- Releases need one changeset per user-facing change. `tests/unit/release.test.js:191` parses a changeset's front
  matter and skips once `changeset version` has consumed it; `:180` is its changelog twin. `:63` already proves,
  in a temp workspace, that a plots minor plans nothing else. `@eleoptics/plots` is at 0.3.0 on npm.
- `index.d.ts` documents `labels` as "drawn at the image end of that fan's chief ray". That stays true, so the plan
  needs no Core change.
- Prior art: nothing to reuse. Label width is estimated at 6 px per character of the raw label (`--font-mono` at 10 px, a 0.6 em
  advance; DejaVu Sans Mono, the Linux fallback, is 6.02 px, which the 2 px pad absorbs). `getBBox` would be exact, but it needs a DOM, and `layout2D` returns a string, also under SSR. O2
  checks the estimate against real rendering in Chromium.

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `layout2D`'s default look is #126's: no end dot; each field label starts 6 px right of the image plane, its baseline 4 px below its chief end; rays 1 px in a group at opacity .85; scale text "10 mm". The dashed chief, glass, stop and image marks, and the colours are unchanged. | given each U3 fixture and the sample, with a label per fan, when drawn at 1000 and 480 px wide, then there is no `<circle>`; each label is `start`-anchored at (X(image z) + 6, Y(chief end y) + 4) within 0.01 px; every ray polyline has a 1px stroke width inside a `<g opacity=".85">`; the scale text is exactly `10 mm` | `spec #126 (user): the new-defaults table`; `user` the gallery's layout tiles in both themes against main's, approved at M1's demo (roadmap, Design references, U3) | `tests/unit/layout2d.test.js::new defaults (#126)` |
| O2 | Everything `layout2D` draws lies inside its viewBox, labels included. | given each U3 fixture drawn on the standalone page with labels `L.rays.map((_, k) => ['0°', '12.5°', '24°'][k])`, at 1000 and 480 px, when the page is screenshotted (`page.screenshot({ clip })`, the SVG's box grown 12 px on every side) with the SVG's `overflow` hidden and visible, then the two are identical | `property: overflow hidden and visible draw the same pixels around the SVG (roadmap row L exit; #117's measurement)` | `tests/gallery.spec.js::layouts stay inside the viewBox (#117)` |
| O3 | On a page with only `tokens.css`, `layout2D`'s texts look as `.eleo-tick` does under `plots.css`. | given the standalone page (tokens only), and a page loading `tokens.css` and `plots.css` with a bare `<svg><text class="eleo-tick">`, when each text's computed `font-family`, `font-size`, `font-weight` and `fill` are read, then the scale text's equal the bare text's | `spec plots.css .eleo-tick (plots.css:127)`, through a text `layout2D` didn't draw | `tests/gallery.spec.js::standalone label style (#112)` |
| O4 | The release is planned: a changeset asks for a minor of `@eleoptics/plots` only. | given the branch, when `.changeset/layout-defaults.md`'s front matter is parsed, then it is `{"@eleoptics/plots": "minor"}`; skipped once consumed, when its twin finds the plots CHANGELOG entry under `### Minor Changes` | `spec roadmap row L exit (the release is planned); semver 0.x: a minor carries a look change (release.test.js:172-174, the #41 precedent)` | `tests/unit/release.test.js::layout defaults changeset asks a plots minor`, `::layout defaults changeset became a plots minor` |

## Non-goals

- Changing `--stroke-ray` in tokens: the website would have to bump two packages (roadmap review 2026-10-07,
  finding 8). The token is left as it is, unused in `packages/`; row J (layout3D) can use it or drop it.
- Spacing close labels apart (#70): every label moves by the same offset, so the gaps between labels don't change,
  and no layout we draw hits it.
- Input hardening (#136, #138, #139, #125): the roadmap deferred these so the website's release stays small.
- Publishing: the user merges the Version Packages PR after this PR merges. That happens outside the plan, and the
  row's exit waits for it.
- An option to bring back the dot or the old label placement: nobody has asked for one.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| #126 | absorb | O1; #146, #147, #148, #149 |
| #117 | absorb | reused as work item #117 (O2) |
| #112 | absorb | reused as work item #112 (O3) |
| #70 | related | the gaps between labels are unchanged (Non-goals) |
| #136, #138, #139, #125 | related | deferred by the roadmap (Non-goals) |

## Constraints and assumptions

- U3 and U4 keep passing. The fixture round trip inverts the mm group's own transform, so it still holds when the
  padding changes `s` and `tx`.
- The roadmap allows `eleo-layout.js` to grow by 2 kB gzipped in this row.
- Assumption: in `--font-mono` at 10 px, a label is at most 6 px wide per character. O2 checks it in Chromium.
- The room for labels depends on the longest non-null label (raw text, whatever its fan holds: CR #153), so drawings that
  share a scale need the same `box`, `width` and labels. The website passes the same labels to every drawing it
  compares.
- A layout with no image surface puts each label 6 px past its own chief end's z.
- The tick style goes on as presentation attributes, so `plots.css` and a consumer's own `.eleo-tick` rule still
  win. `font-variant-numeric` has no attribute; it changes nothing in a monospace font.

## Decisions

- No ADR: these are one renderer's defaults, and the user decided them in #126.
- #126 (user) replaces two assertions in existing tests. `labels at the image` no longer requires an `end` anchor
  near the right edge, because labels are `start`-anchored with room reserved. The IMA test finds the scale text as
  `10 mm`. Each test's oracle and its other checks are unchanged.
- `box pins the transform`'s oracle (user, 2026-10-07) becomes `s = (W - 4 - room) / (zmax - zmin)`,
  `tx = 2 - zmin·s`, `ty` unchanged, with `room = 0` without labels.
- Core (user, 2026-10-07): `index.d.ts:36` becomes "drawings with one box, width and labels share a scale".

## Milestones

### M1: The website's defaults GitHub: `P144 M1: The website's defaults`

Demo: before the first layout change, the orchestrator screenshots main's gallery layout tiles in both themes and
uploads them to the draft `review-assets` release (never committed). At the demo, `npm run gallery` shows the
layout tiles in both themes beside those: no end dot, labels past the image plane, lighter rays, "10 mm", nothing
clipped. Then `tests/fixtures/standalone-layout.html`: the texts are styled with only `tokens.css`. After the
user's go, the orchestrator records U3's new baseline in the roadmap's Design references. Proves: O1, O2, O3, O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #145 | O1 to O4 acceptance tests, skipped; the size test's baseline re-recorded at row L's start | forced (`workflow.md`, TDD: the first item writes them skipped; roadmap Constraints: the 2 kB budget is per row) | `tests/unit/layout2d.test.js`, `tests/gallery.spec.js`, `tests/unit/release.test.js`, `tests/unit/layout-size.test.js` | the five tests in Outcomes, skipped; `layout-size.test.js::standalone layout entry within budget` against this plan's base |  |
| #112 reuse | The tick style as presentation attributes on every text `layout2D` draws (STO, IMA, labels, scale) | `fill="var(--ink-muted)" font-family="var(--font-mono)" font-size="10" font-weight="400"`, keeping `class="eleo-tick"`, because attributes lose to any CSS rule, so `plots.css` and consumers' own rules still apply; considered an inline `style`, which beats every class rule, and documenting that `plots.css` is needed, which breaks the entry's "only `tokens.css`". Doc: README, Without a bundler: "`eleo-layout.js` styles its own texts, so `tokens.css` is all it needs." | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md` | `layout2d.test.js::texts carry the tick style` (every `<text>`'s attributes equal `plots.css:127`'s declarations, parsed from the file) | #145 |
| #146 | No end dot; the chief tests read the dashed chief polyline's last point; `layout2d.js:3`'s header comment loses "the chief dot" | read the chief end from the mm group, where the polyline already is, because chief selection stays separate from label layout; considered finding it from the label's position, which ties the two together | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js` `dotAt` rewritten to `chiefEnd`; the empty-fan case asserts no `<circle>` | #112 |
| #147 | Rays 1 px, in one `<g opacity=".85">` | a group opacity because it is one attribute and crossings don't darken; considered `stroke-opacity` per polyline, which darkens where rays cross, and changing `--stroke-ray`, which needs a tokens release (roadmap review finding 8) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::rays are 1 px at .85` | #146 |
| #148 | Scale text "10 mm" | forced (#126, user) | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | the IMA test finds the scale text as exactly `10 mm` | #147 |
| #117 reuse | Pad the drawing in z by 2 px at each end: `s = (W - 4) / (zmax - zmin)`, `tx = 2 - zmin·s` | a fixed 2 px (more than half of `--stroke-curve` and of the 1 px ray, plus DejaVu's 0.02 px a character), because the stroke widths are fixed; considered reading the stroke tokens, which needs computed styles a string renderer doesn't have | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::the image line clears the right edge`; `box pins the transform` on the new formula (user) | #148 |
| #149 | Labels past the image plane: `start`-anchored at (X(image z) + 6, Y(end) + 4), with `room = 6 + 6 × the longest drawn label's length` px on the right, inside the 2 px pad; the comments at `layout2d.js:114-117,124` updated | room from the longest label, because short labels then cost little width; considered a fixed room of 6 characters whenever labels are given, which wastes width for "0°" and clips longer labels. Docs: README `labels` ("drawn 6 px past the image plane, beside the end of that fan's chief ray, with room kept for them") and `box` ("drawings with the same `box`, `width` and labels share one scale"); the plots-svelte README's "same `box`" sentence; `index.d.ts:36` (Core, user). The worker may run O2 unskipped locally to tune the factor | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js`, `packages/plots/README.md`, `packages/plots-svelte/README.md`, `packages/plots/src/index.d.ts` | `layout2d.test.js::labels at the image` (end-anchor assertion replaced, #126); `box pins the transform` with `room` | #117 |
| #150 | Changeset: a minor of `@eleoptics/plots`, text: "`layout2D`'s new defaults: no dot at the chief ray's end; field labels 6 px past the image plane, with room kept for them; rays 1 px at .85 opacity; the scale bar reads `10 mm`; nothing drawn outside the viewBox; texts styled without `plots.css`." | forced (`.changeset/README.md`: every PR that changes a published package adds one) | `.changeset/layout-defaults.md` | O4 | #149 |
| #151 | Unskip the O1 to O4 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them); `layout2d.js` listed for the label-width factor, should O2 need it | `tests/unit/layout2d.test.js`, `tests/gallery.spec.js`, `tests/unit/release.test.js`, `packages/plots/src/layout2d.js` | the five tests | all above |
| #154 | Label room counts every non-null label, whatever its fan holds (CR #153, review M1 round 1 finding 1) | count every non-null label because `index.d.ts:36` (user) promises one box, width and labels give one scale; considered amending the docs to exclude empty fans, which leaves the comparison trap | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js::box pins the transform` (empty-fan case) | #151 |
| #155 | Name a width too narrow for the labels (review M1 round 1 finding 2) | throw `layout2D: width too narrow for the labels` because a non-positive scale mirrors the drawing silently; considered clamping room, which clips labels without telling | `packages/plots/src/layout2d.js`, `tests/unit/layout2d.test.js` | `layout2d.test.js` width-40 case | #154 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| 6 px a character is too narrow for `--font-mono`'s glyphs (°, digits) | O2 fails; labels clip | The labels item runs O2 locally (texts are styled by then, item 2); the unskip item can raise the factor |
| A label under the lowest chief end lands on IMA | Overlap at the image | The IMA rule (#64) already puts IMA at least 12 px below the lowest label, and its test stays |
| Group opacity reads differently from #126's "opacity .85" | A look the user didn't expect | The user sees it at the M1 demo; `stroke-opacity` is the one-line fallback |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-07: critique (general-purpose, claude-opus-5-5)
  - 1: accepted: O2's labels follow the fixtures' 3 fans.
  - 2: accepted: O2 screenshots the page around the SVG.
  - 3: accepted: O3 compares with a bare `.eleo-tick` text; item 2 tests the attributes against `plots.css:127`.
  - 4: accepted: `box pins the transform` listed; its new oracle is the user's (accepted below).
  - 5: accepted: `index.d.ts:36` listed as Core (accepted below); the plots-svelte README added.
  - 6: accepted: the tick style item moved before the labels; the unskip item can tune the factor.
  - 7: accepted: the tick style item gets its unit test.
  - 8: accepted: O4 parses the changeset with a consumed twin; oracle cites the #41 precedent.
  - 9: accepted: main's tiles go to `review-assets` before the first layout change; U3's baseline recorded after the demo.
  - 10: accepted: the size baseline joins item 1.
  - 11: accepted: room from raw drawn labels; no-image fallback; comments updated.
  - 12: accepted: exact changeset and README text.
  - 13: accepted: presentation attributes instead of an inline style.
  - 14: accepted: one group opacity.
  - 15: rejected: #117 is its own fix with its own issue, and one behaviour per commit; the transform test is touched twice, a few lines each.
  - 16: no change.
  - 17: partly: item 2 merged (10); items 3 to 5 stay separate, one behaviour each.
- 2026-10-07 (user): `box pins the transform` asserts s = (W - 4 - room) / (zmax - zmin), tx = 2 - zmin·s (accept); `index.d.ts:36` says one box, width and labels share a scale (change).
- 2026-10-07 headless: plan approved, 1 milestone, 9 items; the critique's finding 15 kept as drafted (row: Choose, add or reorder rows (`/roadmap next`), milestone acceptance within the plan).
- 2026-10-07: review M1 round 1 (code-reviewer): 1 blocking, 2 backlog. Finding 1 is CR #153, accepted (it keeps every invariant and makes the code match `index.d.ts:36`), and becomes work item #154. Finding 3 is plain issue #156.
- 2026-10-07 headless: backlog #155 into M1 (row: Choose, add or reorder rows (`/roadmap next`), milestone acceptance within the plan).
