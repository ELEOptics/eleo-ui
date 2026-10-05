# Plan #4: Brand fixes: colour-blind-safe field colors, glass segmented control

Status: approved 2026-10-05
Branch: `plan/4-brand-fixes` PR: #12 Depends on: none Roadmap: `agent_docs/roadmap.md`, row A

## Problem

Every renderer colors fields `--field-1`, `-2`, `-3` in that order, and `--field-2` reads as amber, which the brand
keeps for the one accent; the order has never been checked for colour blindness. eleoptics.com draws fields 1, 7, 8,
recorded as passing, but measured here that trio fails too: fields 1 and 7 are ΔE2000 6.8 apart under dark-theme
protanopia, and field 8 sits 7.9 from amber under light tritanopia. `.eleo-seg` marks its selected option with an
amber underline, a second accent next to a page's amber button. The website's Switch row waits on both fixes.

## Ground truth

- `packages/plots/src/renderers.js:36` `idx(i)` returns `var(--field-<i%8+1>)`. It is the index color for fields
  or wavelengths: `layout2D`, `spot` (default `colorBy: "wavelength"`, `:119`, `:128`), `throughFocus` (`:147`),
  `rayFan` (wavelengths only, `:171`), `curve` (MTF fields, `:210`) and `legend` (`:235`, `:236`). `layout3D`
  (`:101`) hard-codes `C("field-1")`, `-2`, `-3` and reads `window.devicePixelRatio` (`:72`). `curve`'s
  single-series kinds use `var(--field-1)`, first in any order.
- Field tokens live in `packages/tokens/src/tokens.json`, a copy of the design system's token file (`build.mjs`
  header); each usage says "3:1 or more on surface in both themes". `README.md:62`: token changes mostly need no
  renderer change.
- `packages/plots/src/plots.css:36` `.eleo-seg input:checked + span { box-shadow: inset 0 -2px 0 var(--accent) }`.
  `--glass-edge` is the lens-rim color, 5:1 on surface.
- The gallery (`gallery/index.html`) stamps `<template id="tiles">` (`:36`) into each theme column; 15 tiles carry
  `data-tile`, counted by `tests/gallery.spec.js:24`. It has no segmented control.
- Unit tests: `node --test tests/unit/*.test.js`, the only tests `check.sh --fast` runs. `renderers.js` and
  `sample.js` import in Node 24; SVG renderers run headless. New test files need an `oracle:` line (pre-commit hook).
- culori 4.0.2 (approved dev dependency) exports `filterDeficiencyProt`, `Deuter`, `Trit`, `differenceCiede2000`,
  `wcagContrast`. Not installed yet.

## Outcomes

Conditions: light and dark themes × normal vision, protanopia, deuteranopia, tritanopia (Machado 2009, severity 1,
culori), colors from `packages/tokens/src/tokens.json`, distances ΔE2000 (culori `differenceCiede2000`).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 (U1) | Every renderer colors index 1 to 3 with fields 1, 7, 8, and those three stay distinguishable and away from amber in every condition | given the tokens and the sample; when `layout2D`, `spot`, `throughFocus`, `rayFan`, `curve` (MTF), `legend` and `layout3D` draw; then each uses fields 1, 7, 8 for its first three indices, and in every condition the three are pairwise at least as far apart as fields 1, 7, 8 measured at `cc675cf` in that condition and at least 10, each is at least 20 from `--accent`, and each is 3:1 or more on `--surface` | `paper Machado, Oliveira & Fernandes 2009, via culori's deficiency filters and CIEDE2000; property` as reworded 2026-10-05 (user); contrast `spec WCAG 2.2` via culori `wcagContrast` | `tests/unit/field-order.test.js::first three fields stay apart and away from amber` |
| O2 (U2) | `.eleo-seg` marks the selected option in glass, not amber | given the gallery's segmented control in both theme columns; when an option is checked; then its marker color is `--glass-edge` (computed rgb), and no computed color of the control equals `--accent` | `user ELEO design system (claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt): one amber accent per view` | `tests/gallery.spec.js::segmented control marks in glass` |
| O3 | Index 4 to 8 follow the same idea: each next field is the one least confusable with those placed and with amber | given fields 1, 7, 8 placed; when positions 4 to 8 are recomputed greedily (each next is the remaining field whose minimum ΔE2000 over all conditions to the placed fields and `--accent` is largest; ties to the lower token number); then the result equals the renderers' order | `paper Machado, Oliveira & Fernandes 2009, via culori; property: greedy max-min ΔE2000 with --accent placed` (user, round 2) | `tests/unit/field-order.test.js::index 4 to 8 are the greedy order` |

## Non-goals

- Exporting the order as public API (`fieldOrder`): the renderers and `legend` cover every use the website has; next plan if Phos needs it (#13).
- Retuning fields 1 to 6: only 7 and 8 fail; field 2 and 5 stay amber-like but move late (O3).
- Screenshot baselines for the gallery: the M1 demo in both themes is the visual check (round 2); the existing gallery test still checks every tile draws.
- Updating the design system artifact: the user does it when signing off the spike's values; this repo copies them.
- The release: it ships with the Layouts row (roadmap constraint); this plan adds its changeset only.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#2] | absorb | the row's issue: this plan delivers it |
| [#3] | related | Layouts row, next plan; waits on this one (both edit `renderers.js`) |

## Constraints and assumptions

- Recorded baseline for O1's pairwise clause: fields 1, 7, 8 hex values in both themes at `cc675cf`, pinned in the
  test as a fixture with that source (they change in #7, so the test must not read them from `tokens.json`).
- Feasibility, measured before approval (scratchpad search over OKLCH, both themes): 1711 light and 614 dark
  candidate colors meet O1's per-color clauses; the best 7/8 pairs clear the pairwise floors by 1.5×. The spike
  picks among them.
- Field index 9 to 16 keeps today's rule (reuse with a hollow marker), over the new order.
- eleoptics.com keeps its own copies of field-7/8 until its Switch row; the new values reach it with the release.

## Decisions

No ADR: the order is pinned data checked by a test, the tokens are design-system values. Roadmap changes, approved
here: U1's oracle reworded (accent clause → floor 20, contrast clause added) and row A's scope gains "field-7/8
retuned". Core: none (`CLAUDE.md` lists no core paths yet). `package.json` and `package-lock.json` change (culori):
a security trigger for `director/merge.sh`, so this PR merges by hand.

## Milestones

### M1: one CVD-safe field palette and a glass segmented control GitHub: `P4 M1: Brand fixes`

Demo: `npm run gallery`, both theme columns: every plot's first three index colors are fields 1, 7, 8 with the new
7 and 8, none amber; the segmented-control specimen marks its selection with a glass-edge underline; the spike's
comment shows the measured margins. Proves: O1, O2, O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #5 | O1, O2, O3 acceptance tests, skipped; culori added | forced (`workflow.md`, TDD: the first item writes them skipped); culori via `npm i -D culori@4.0.2` (lock updated for `npm ci`) because it implements Machado 2009, CIEDE2000 and WCAG contrast and is approved (roadmap Change log); considered hand-coding the matrices, ruled out by the approval and the prior-art rule. Records the O1 test's measured minimum (unskipped once, locally) in the issue comment | `package.json`, `package-lock.json` | `tests/unit/field-order.test.js` (2 tests, `{ skip: '#<i>' }`, `oracle:` line), `tests/gallery.spec.js::segmented control marks in glass` (`test.skip`) | none |
| #6 | Spike (timebox 2 h): pick field-7 and field-8 values for both themes | output: an issue comment with a table (hex per theme, hue, each O1 clause measured with its margin, contrast) and swatches, from a culori search script kept out of the tree; same hue family across themes, near today's violet and rose; the user signs the values off and puts them in the design system. Spike because the values are a design choice the code can't settle; considered letting the token item pick them, ruled out because the design system owns them (Non-goals) | none (comment only) | none (spike: `workflow.md`, Work items) | #5 |
| #7 | `field-7`, `field-8` take the signed-off values | forced (#6's signed-off values; `tokens.json` copies the design system) | `packages/tokens/src/tokens.json` | `tests/unit/tokens.test.js::field-7 and field-8 are the signed-off values` (`oracle: user` #6's sign-off comment; red until the values land); O1 covers their contrast | #6 |
| #8 | SVG renderers color index colors in the new order | `var ORDER = [1, 7, 8, …]` read by `idx(i)` because every SVG renderer already colors through `idx`; positions 4 to 8 computed once with O3's rule on #7's tokens and pinned, so a later token change turns O3 red instead of reordering silently; considered computing `ORDER` in `build.mjs` from `tokens.json` (critic), ruled out by that silent reorder; considered reordering token values, ruled out (design system's file, website names `--field-7`). README gains: "Index colors (fields or wavelengths) run fields 1, 7, 8, then …, chosen for colour-vision safety" | `packages/plots/src/renderers.js`, `packages/plots/README.md` | `tests/unit/renderers.test.js::svg renderers share one index order starting 1, 7, 8` (`oracle: spec roadmap U1`): `spot({colorBy:'field'})`, `layout2D`, `rayFan`, `curve` (MTF) and `legend('field', 8)` emit `var(--field-1)`, `-7`, `-8` first, and the legend lists all 8 once | #7 |
| #9 | `layout3D` draws rays in the new order | `C("field-" + ORDER[k])` because it is the one renderer not routed through `idx`; Node test with stubs (canvas context recording `strokeStyle`, with no-op `scale`, `setLineDash`, `fillText`, `fill`; `globalThis.window = { devicePixelRatio: 1 }`; `getComputedStyle` returning each token's name) because only unit tests run in `check.sh --fast`; considered a Playwright `addInitScript` spy on the gallery canvas (critic), ruled out because the fast gate never runs it | `packages/plots/src/renderers.js` | `tests/unit/renderers.test.js::layout3D strokes fields 1, 7, 8` | #8 |
| #10 | `.eleo-seg` marks the selection in glass; the gallery shows one | forced (user, round 1: `box-shadow: inset 0 -2px 0 var(--glass-edge)`); the specimen goes inside `<template id="tiles">` without `data-tile`, so it renders in both theme columns and the count (15) stays; considered a new tile, which changes the count test for no demo gain | `packages/plots/src/plots.css`, `gallery/index.html` | `tests/gallery.spec.js::checked segment uses glass-edge in both themes`: each column's checked span's computed `box-shadow` rgb equals its `--glass-edge` | #5 |
| #11 | Unskip O1, O2, O3 acceptance tests; changeset; README token note | forced (`workflow.md`, TDD: the last item unskips them); one changeset, minor for `@eleoptics/tokens` (field-7/8) and `@eleoptics/plots` (index order, seg marker), because the row ships in the Layouts release (roadmap constraint); `README.md:62` gains "except the field colors: their order is pinned in `renderers.js` and checked against the tokens, so a field token change reruns that check" | `.changeset/brand-fixes.md`, `README.md` | the acceptance tests above, green | #8, #9, #10 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| The user rejects every spike candidate | #7 blocks | the spike shows at least three pairs per theme; a further miss is a CR |
| O3's greedy rule ties two candidates | the pinned order is ambiguous | ties break by lower token number, stated in the test |
| New 7/8 shift other tiles' look (wavelength plots use them too) | demo surprise | the demo covers every tile in both themes |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-05: drafted from roadmap row A and [#2].
- 2026-10-05 round 1 (user): buckets confirmed ([#2] absorb, [#3] related); positions 4–8 ranked by CVD distance; `.eleo-seg` marker `inset 0 -2px 0 var(--glass-edge)`; one milestone.
- 2026-10-05 round 2 (user): O3's rule is greedy max-min ΔE2000 with `--accent` counted as placed; the visual check is the M1 demo only, no screenshot baselines.
- 2026-10-05 critique (plan critic, claude-fable-5-1) finding 1, re-measured: the A / U1 kill criterion fires (fields 1–7 at 6.8, dark protan); no reorder meets U1's accent clause.
- 2026-10-05 kill ask (user): pivot, tune field tokens.
- 2026-10-05 round 3 (user): U1's oracle reworded: pairwise ≥ today's 1, 7, 8 per condition and ≥ 10, each ≥ 20 from `--accent`, each 3:1 on surface; field-7/8 retuned through a spike. The approved clause "as far from `--accent` as field 1" admits only blues (measured), so no palette meets it.
- 2026-10-05 critique applied: findings 2 (idx colors wavelengths too), 3 (layout3D stubs), 4 (After as item numbers), 5 (specimen in the template, both themes, rgb), 6 (README note), 7 (oracle lines), 8 (`npm i -D`), 11 (`forced (user)`). Rejected: 9 (Playwright spy; the fast gate runs unit tests only), 10 (build-time order; it would reorder silently on a token change).

[#2]: https://github.com/ELEOptics/eleo-ui/issues/2
[#3]: https://github.com/ELEOptics/eleo-ui/issues/3
- 2026-10-05 approval (user): plan approved; published as #4 with work items #5 to #11.
