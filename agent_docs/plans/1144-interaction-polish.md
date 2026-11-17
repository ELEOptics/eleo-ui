# Plan #1144: Interaction polish (row K)

Status: approved 2026-11-17
Branch: `plan/1144-interaction-polish` PR: #1160 Depends on: none Roadmap: `agent_docs/roadmap.md`, row K

## Problem

H ([#804]) shipped keyboard and hover with gaps its reviews left as backlog: the keyboard ignores where the pointer is, never steps bars or layout rays, and `stop()` leaves a `tabindex` behind; the hover tooltip floods a screen reader with every interpolated move; dashed limit lines crawl on a pan. The specs carry hand-copied parsers (one already stale against [#1121]) and fractional pointers, and `export.spec.js` is the gate's one source of red today (two flakes). Each is too small for a row alone; together they are row K.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | The specs parse drawn points and data-group matrices through one shared helper that reads exponent dot lengths and takes only a lone matrix; zoom and pan tests aim at whole pixels. | Given `tests/unit/helpers/svg.js`, when `subpaths` parses #1126's path `M0.001,0.002 h6.7e-7 M0.003,0.004 h6.7e-7`, then it returns both points (a characterization: it already does); `matrixOf('matrix(1 0 0 1 2 3)')` is the six numbers and `matrixOf('matrix(1 0 0 1 2 3) translate(1)')` is null; and a scan of `tests/*.spec.js` finds no `matrix\\(` or `h\\s*` regex of its own (today it finds 19 lines). | `closed-form #1126's path and #1067's anchored rule (interact.js matrixOf's shape, as tests/unit/interact-matrix.test.js mirrors it)` | `tests/unit/spec-helpers.test.js` |
| O2 | `export.spec.js` stops flaking. | Given the file with #1118's fix (from the spike, by CR) and #1125's 20 s wait, when the full file runs with `--repeat-each=15` in Chromium and `--repeat-each=3` in Firefox and WebKit, then all pass. Unfixed, #1118 (2 of 11) fails 15 Chromium repeats about 95% of the time. | `measurement: the repeat runs green, recorded in the Change log`; `spike #1118's finding` | M1 demo run |
| O3 | The keyboard starts where the pointer is and steps every hoverable mark: curve and spot points, bars, layout2D rays. | Given the gallery's MTF, bars and layout tiles, when the pointer hovers mark k and ArrowRight is pressed, then the event is mark k's next (curve: index k+1; bars: category k+1 of the same series; rays: ray k+1 of the same field), and ArrowDown moves to the next series (bars) or field (rays). An interpolated hover sets the segment's nearer end; a pointer leave keeps the current point (Escape still clears it). | `spec #1004 (1, 3)`; the expected marks from the tile's data (`fixture: gallery sample.json`) | `tests/interact.spec.js::keyboard starts at the hovered point`, `::keyboard steps bars`, `::keyboard steps rays` |
| O4 | `stop()` leaves the host's `tabindex` as it found it. | Given a host with no `tabindex`, when `interact` is called twice and stopped once, then `tabindex="0"` stays; stopped twice, the attribute is gone. Given a host with `tabindex="-1"`, after interact and stop it is still `-1`; a host whose caller changed the added `0` to `2` keeps `2`. | `spec #1004 (2)` (reference counted, as the `eleo-hover-host` class already is) | `tests/interact.spec.js::stop restores tabindex` |
| O5 | A screen reader hears only snapped data points and keyboard steps, not interpolated moves; the visible tooltip still shows interpolated readings. | Given #883's 36-move pointer sweep along an MTF line, when it runs, then the live region's text changes once per distinct snapped point (hover events without `interpolated`) and the visible tooltip's text changes as today; each arrow key changes the live text once. | `spec #883, option snapped points only (user, round 1)` | `tests/interact.spec.js::live region announces snapped points only` |
| O6 | Dashed limit lines hold still on a pan. | Given the zoomed MTF-limits tile, when it pans by Δ px along x (both directions, past the unzoomed range), then each dashed horizontal limit's dash origin in screen px (line start − `stroke-dashoffset`, mod the pattern length) moves by Δ. | `metamorphic: a pan by Δ px shifts the dash origin by Δ mod the period` (#996) | `tests/interact.spec.js::limit dashes hold on a pan` |
| O7 | Nothing else changes: every tile looks the same, and `interact`, `curve` and `bars` stay in budget. | The gallery's Playwright screenshots at the plan's head equal those at M2's start, pixel for pixel, or each differing tile is approved at the M2 demo; U14's hover, curve and bars medians stay under 16 ms. | `user the tile screenshots at M2's start (roadmap, Design references)`; `measurement: roadmap U14 (PERF=1 tests/perf.spec.js)` | `SHOTS=1 SHOTS_BASE=<dir> tests/gallery-shots.spec.js`, `PERF=1 tests/perf.spec.js` |

## Non-goals

- [#534] legend outside the tile: waits for phos (roadmap).
- [#850] parse marks once, [#997] zoomed map2D grid: their triggers (a redraw over budget) have not fired (roadmap).
- Debouncing the live region on a resting pointer: snapped-only is deterministic and has no timer (user, round 1).
- Loading the gallery once per theme in `eachTile`: risks state leaking between cases; the 20 s wait fixes [#1125] (user, round 1).
- A product-side retry for [#1118] before its cause is known (user, round 1: spike first).

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| [#855] | absorb | O1, items in M1 |
| [#1067] | absorb | O1 |
| [#1126] | absorb | O1 |
| [#1064] | absorb | O1 (`moveTo` at the fractional sites) |
| [#1098] | absorb | O2, reused as its item |
| [#1125] | absorb | O2, reused as its item |
| [#1118] | absorb | O2, reused as the spike |
| [#1004] | absorb | O3, O4 (three items) |
| [#883] | absorb | O5, reused as its item |
| [#996] | absorb | O6, reused as its item |
| [#323] | absorb | M2, reused: the tidy of the same `limitBody` call [#996] changes |
| [#534], [#850], [#997] | related | Non-goals |
| [#281] | related | the perf harness; O7 needs no change to it |

## Constraints and assumptions

- Every spec parse site runs inside the page (`interact.spec.js:23`, `:908-910`; `zoom-budget.spec.js:79-82` in a rAF; `perf.spec.js:213-215` in the timed harness), so the shared pure helpers are injected once per page with `page.addInitScript` from their source, not called in Node.
- `tests/unit/helpers/svg.js` already exports `subpaths` (skips `h` dots whatever their number form) and `nums`; it imports `node:assert`, so the injected helpers must stay free of it.
- `interact.js`'s keyboard model (`keyMarks`, `curSpot`, `visiblePoints`, `refresh`, `interact.js:315-376`) reads `runs(m).p` and ids from `data-panel`/`data-series`: a rect has no runs and a ray has neither attribute, so bars and rays need a per-kind point list first.
- The tooltip is the polite live region (`overlay`, `interact.js:111-130`, `hide` and `showTip` find it as the last child; `interact.spec.js:269` asserts its `aria-live`); its styles are in `packages/plots/src/plots.css`.
- Keyboard and hover are documented in `packages/plots/README.md` (Hover, Keyboard), pinned by `tests/unit/interact-docs.test.js`; `index.d.ts:538` stays true.
- `dashOffset` (`clip.js:42`) returns `""` for a cut-off of 0 or less; limit dashes are `6 3 1 3`, non-scaling (`curve.js:16,144`, `limits.js:45`); `plotCell` has `sx`, `sy` (`curve.js:124`).
- `limitBody` is internal (`curve.js:147`, `bars.js:2,59`): not in `index.js`, `index.d.ts` or `exports`.
- `export.js:13` already throws on a non-ok font response, so #1118 is not a failed request: a truncated 200 body or a FontFace race (assumption; the spike settles it).

## Decisions

ADR-0001 (plot boundary), ADR-0003 (plot scale). No new ADR and no core change: `index.d.ts` and the packages' `exports` are untouched (O3 to O5 sit behind `interact`'s existing signature; the `onhover` event shape for bars and rays is today's).

## Milestones

M1 first because M2's new tests in `interact.spec.js` then use the shared helper instead of the copies M1 removes, and M2's waves run on a gate that no longer flakes. M1 is tests only, not a walking skeleton in production code: K has no unproven premise to skeleton. 20 items, over the 15 aim: the row's eleven issues plus the keyboard refactor bars and rays need; split by milestone if you want two rows.

### M1: one parser, a green gate GitHub: `P1144 M1: one parser, a green gate`

Done 2026-11-17: review round 2 (Review M1: 0 blocking, nothing pulled in); full gate green on ae97ddd (505 passed); CI pending on ae97ddd at the tick. Demo: go (user, 2026-11-17).

Demo: `npm run test:unit` shows `spec-helpers.test.js` green, its scan finding no own parser; `npx playwright test tests/export.spec.js --project=chromium --repeat-each=15` and `--repeat-each=3` in Firefox and WebKit green; #1118's spike comment names the cause and its CR's item is done. Proves: O1, O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1145 | O1 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/spec-helpers.test.js` | `spec-helpers.test.js` (skipped) | none |
| #1146 | `matrixOf` beside `subpaths`, and `pageHelpers(page)` that injects them with `moveTo` | `matrixOf(str)` in `tests/unit/helpers/svg.js` with `interact.js`'s anchored shape, and `tests/page-helpers.js` exporting `pageHelpers(page)` (`page.addInitScript` defining `window.H = { matrixOf, subpaths, nums }` from their source) and `moveTo`, because every parse site runs in the page (critic finding 4); considered parsing in Node after `evaluate`, ruled out: about 15 sites and the timed perf harness would be restructured | `tests/unit/helpers/svg.js`, `tests/page-helpers.js`, `tests/unit/spec-helpers.test.js` | `spec-helpers.test.js::matrixOf anchored`, `::subpaths exponent dot` (characterization) | #1145 |
| #1147 | `interact.spec.js` on the shared helpers and `moveTo` | each parse becomes `H.matrixOf` / `H.subpaths`; #1064's fractional moves become `moveTo`, expecting the point about the delivered pixel where a test checks it (as `layout zoom pan and reset` does); considered keeping `drawnAt` local, kept only as a call of `H.subpaths` | `tests/interact.spec.js` | the file's own tests, three browsers | #1146 |
| #1148 | `gallery.spec.js` and `svelte.spec.js` on the shared helpers and `moveTo` | as above for `drawnPoint`, its three matrix sites and eleven moves; considered one item per file, merged: one-line substitutions, one behaviour | `tests/gallery.spec.js`, `tests/svelte.spec.js` | their own tests, three browsers | #1146 |
| #1149 | `zoom-budget.spec.js` and `perf.spec.js` on the shared helpers | the dot regex and matrix parses to `H.*`, inside the rAF and the timed harness unchanged; considered skipping perf (PERF-only), ruled out: O1's scan covers every spec | `tests/zoom-budget.spec.js`, `tests/perf.spec.js` | their own tests, `PERF=1 npx playwright test tests/perf.spec.js` | #1146 |
| #1150 | Unskip O1 | forced (`workflow.md`, TDD: the last item of O1 unskips it) | `tests/unit/spec-helpers.test.js` | `spec-helpers.test.js` | #1147, #1148, #1149 |
| #1098 reuse | `export.spec.js`: one `faceCheck` and one in-page `countDiff` | the two helpers replace the copied face check and diff loop (about 25 lines); considered leaving the copies, ruled out: #1118's spike edits the face check, which would then need editing twice | `tests/export.spec.js` | the file's own tests | none |
| #1125 reuse | `eachTile`'s reload waits 20 s | `toHaveAttribute(..., { timeout: 20_000 })` on that one wait because only it reloads per case (user, round 1); considered once-per-theme loading, ruled out by the user (state leaks) | `tests/export.spec.js` | the file's own tests | #1098 |
| #1118 reuse | Spike, timebox 2 h: why the embedded Fira Code 400 sometimes won't load | log each embedded face's data URL length and the `FontFace.load` error, run the full export spec until it fails or 15 runs pass; output an issue comment naming the cause and the fix, which becomes a work item by CR (user, round 1) and lands before the next item; considered a product retry now, ruled out by the user | none committed (a local patch) | n/a (spike) | #1125 |
| #1163 | `faceCheck` quotes the data URL it rewraps (CR #1161) | `url("${src}")` in `new FontFace` because an unquoted url() cannot hold the `; ` of a parameterised MIME (#1118's spike); considered normalising the MIME in `export.js`, ruled out of this plan (#1162, backlog); no retry: the fetch is not what failed | `tests/export.spec.js` | `export.spec.js::faceCheck loads a parameterised MIME` | #1118 |
| #1151 | Record O2's measurement | forced (O2's oracle is a measurement, recorded in the Change log) | this plan's Change log | the repeat runs above | #1118, #1163 |
| #1165 | `export.spec.js`'s `setState` aims with `moveTo` (review M1 round 1, finding 2) | import `moveTo` and use it at the hover aim, as `gallery.spec.js` does, so the whole-pixel rule lives in one place; considered exporting `pixel` for `interact.spec.js`'s copy, left: it feeds `readAt`, not a move | `tests/export.spec.js` | the file's own tests | none |
| #1166 | O1's scan catches the other matrix and dot-length spellings (review M1 round 1, finding 3) | widen the pattern to `matrix\s*\(` and `h-?[`, allow-list `gallery.spec.js`'s dot rewrite by content; considered a regex-literal parser, ruled out: larger than the rule it guards | `tests/unit/spec-helpers.test.js` | `spec-helpers.test.js::no spec parses a matrix or a dot length of its own` | none |

### M2: keyboard, screen reader and dashes GitHub: `P1144 M2: keyboard, screen reader and dashes`

Demo: `npm run gallery`; hover a bar, press ArrowRight and ArrowDown (the next category, the next series); hover a layout ray and step it; with VoiceOver on, sweep an MTF line: it reads only data points; zoom the MTF-limits tile and pan both ways: the limit dashes stay put; the screenshot comparison and U14 medians in the Change log. Proves: O3, O4, O5, O6, O7

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1152 | O3 to O6 acceptance tests, skipped; O7's baseline | forced (`workflow.md`, TDD: the first item writes them skipped); the baseline shots (`SHOTS=1`) and U14 medians (`PERF=1`: hover, curve, bars) recorded before any M2 change, the PNGs to the `review-assets` release | `tests/interact.spec.js`, this plan's Change log | the four tests (skipped) | #1151 |
| #1153 | `gallery-shots.spec.js` compares to a base | with `SHOTS_BASE=<dir>`, each shot is compared pixel for pixel with the base's PNG in the page (canvas `getImageData`) and the differing tiles listed; considered Playwright's `toHaveScreenshot`, ruled out: its snapshots live beside the spec, in git (review images never go in git) | `tests/gallery-shots.spec.js` | `SHOTS=1 SHOTS_BASE=<dir>` against itself: zero differing | #1152 |
| #1154 | The keyboard on a per-kind point list | `step`, `curSpot`, `visible` and `refresh` read `{ id, points: [{ mark, index, x, y, bar? }] }` built per kind, today's curve and spot marks the first adapter; considered patching `keyMarks` for rects, ruled out: rects have no runs and rays no `data-series` (critic finding 2) | `packages/plots/src/interact.js`, `tests/interact.spec.js` | the keyboard tests, unchanged and green | #1152 |
| #1155 | The pointer sets the keyboard's current point | `present` sets `cur` from a hovered key mark (an interpolated hover: the segment's nearer end); a pointer leave keeps it; considered a separate `lastHover` read on keydown, ruled out: two sources of the current point. README Keyboard gains it | `packages/plots/src/interact.js`, `packages/plots/README.md`, `tests/interact.spec.js`, `tests/unit/interact-docs.test.js`, `.changeset/` | `::keyboard starts at the hovered point` | #1154 |
| #1156 | `stop()` restores the `tabindex` it added | a per-host count of the calls that added it (a `WeakMap` beside `hosts`); the last such stop removes it only if it is still `"0"`; considered removing on every stop, ruled out: a second live call loses focusability. README's host bullet gains it | `packages/plots/src/interact.js`, `packages/plots/README.md`, `tests/interact.spec.js`, `.changeset/` | `::stop restores tabindex` | #1155 |
| #1157 | Arrows step bars | a bars adapter: id per `data-series`, points by `data-category`; Left and Right step categories, Up and Down series; considered each rect a one-point series, ruled out: left and right would jump series. README Keyboard gains bars | `packages/plots/src/interact.js`, `packages/plots/README.md`, `tests/interact.spec.js`, `.changeset/` | `::keyboard steps bars` | #1156 |
| #1158 | Arrows step layout2D rays | a rays adapter: id per `data-field`, points by `data-ray` (a ray's runs joined, presented at its first point inside the frame); Up and Down the field at the nearest ray; considered stepping along a ray's points, ruled out: the hover reports a ray, not a point on it. README Keyboard gains rays | `packages/plots/src/interact.js`, `packages/plots/README.md`, `tests/interact.spec.js`, `.changeset/` | `::keyboard steps rays` | #1157 |
| #883 reuse | The live region announces snapped points and keys only | the overlay's children become dot, lines, the visible tooltip (`aria-hidden`), then a visually hidden `role=status` sibling, last; `hide` and `showTip` address both by class; the live text is set only when the event has no `interpolated`; considered a debounce, ruled out by the user (round 1). README Hover gains it | `packages/plots/src/interact.js`, `packages/plots/src/plots.css`, `packages/plots/README.md`, `tests/interact.spec.js`, `.changeset/` | `::live region announces snapped points only` | #1158 |
| #323 reuse | Limits enter `plotCell` one way | `plotCell` wraps its inner markup with `limitMarks` when `limits` is set; `limitBody` goes; first, so #996 reads `sx` in `plotCell`; considered leaving it (the issue says it is not strictly smaller), kept: the user absorbed it (round 1) | `packages/plots/src/curve.js`, `packages/plots/src/bars.js`, `tests/unit/curve.test.js` | `curve.test.js::limitBody is gone` (red: it is exported today), bars and curve tests green | #1154 |
| #996 reuse | Dashed limit lines keep their phase on a pan | a zoomed line's offset is its start's distance from data 0 in px, a positive modulo of the period computed in `limits.js` (so a pan past the unzoomed range and a live redraw at a fixed view both hold); considered the unzoomed range start, ruled out: `scales` drops it and `dashOffset` gives nothing for a negative offset (critic finding 1). `.changeset/` names the fix | `packages/plots/src/limits.js`, `packages/plots/src/curve.js`, `tests/unit/curve.test.js`, `.changeset/` | `::limit dashes hold on a pan`, `curve.test.js::limit dash origin at data 0` | #323 |
| #1159 | Unskip O3 to O6; check O7 | forced (`workflow.md`, TDD: the last item unskips them); O7 by `SHOTS=1 SHOTS_BASE=<baseline>` and `PERF=1` (hover, curve, bars), the results logged here | `tests/interact.spec.js`, this plan's Change log | the four tests, `gallery-shots.spec.js`, `perf.spec.js` | #1152, #1153, #1154, #1155, #1156, #1157, #1158, #883, #323, #996 |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| [#1118]'s cause is a Chromium FontFace race no fix in `export.js` reaches | O2 not met | the spike says so; then a CR (test-side wait or retry), the user's |
| Hiding the tooltip from the accessibility tree changes the gallery screenshots | O7 | the status sibling is visually hidden (clip), so no pixel changes; the last M2 item compares |
| The per-kind refactor changes curve and spot stepping | M2 | the existing keyboard tests stay green in its item, before bars and rays |

## Change log

- 2026-11-17 round 1 (user): issue buckets as proposed (11 absorbed; [#534], [#850], [#997], [#281] related).
- 2026-11-17 round 1 (user): [#883], snapped points only.
- 2026-11-17 round 1 (user): [#1118], spike then fix by CR.
- 2026-11-17 round 1 (user): [#1125], a 20 s timeout on the reload wait.

[#1004]: https://github.com/ELEOptics/eleo-ui/issues/1004
[#1064]: https://github.com/ELEOptics/eleo-ui/issues/1064
[#1067]: https://github.com/ELEOptics/eleo-ui/issues/1067
[#1098]: https://github.com/ELEOptics/eleo-ui/issues/1098
[#1118]: https://github.com/ELEOptics/eleo-ui/issues/1118
[#1121]: https://github.com/ELEOptics/eleo-ui/issues/1121
[#1125]: https://github.com/ELEOptics/eleo-ui/issues/1125
[#1126]: https://github.com/ELEOptics/eleo-ui/issues/1126
[#281]: https://github.com/ELEOptics/eleo-ui/issues/281
[#323]: https://github.com/ELEOptics/eleo-ui/issues/323
[#534]: https://github.com/ELEOptics/eleo-ui/issues/534
[#804]: https://github.com/ELEOptics/eleo-ui/issues/804
[#850]: https://github.com/ELEOptics/eleo-ui/issues/850
[#855]: https://github.com/ELEOptics/eleo-ui/issues/855
[#883]: https://github.com/ELEOptics/eleo-ui/issues/883
[#990]: https://github.com/ELEOptics/eleo-ui/issues/990
[#996]: https://github.com/ELEOptics/eleo-ui/issues/996
[#997]: https://github.com/ELEOptics/eleo-ui/issues/997
- 2026-11-17 critic (Fable): applied findings 1 (dash origin at data 0), 2 (per-kind point list item), 3 (test files in #323 and #996), 4 (helpers injected with addInitScript; six spec items now three), 5 (the scan is a test), 6 (15 Chromium repeats; the CR item before the measurement), 7 (sign), 8 (status as a sibling), 9 (base shots and a comparer), 10 (curve and bars medians), 11 (interpolated and leave cases), 12, 13 (README, interact-docs test, changesets), 14 (characterization), 15 (#323 before #996; #1098's alternative; tabindex removed only if still 0). Rejected none.
- 2026-11-17 approved (user): as drafted, 2 milestones, 21 items.
- 2026-11-17 #1118 spike: cause found (a Google Fonts response typed `text/html; charset=utf-8` makes `faceCheck`'s unquoted `url()` invalid CSS; 1 fail in 15 Chromium runs). CR #1161 accepted by the orchestrator (test-only, no invariant): item #1163, before #1151. The product MIME normalisation is backlog #1162, not this plan.
- 2026-11-17 #1151 O2 measured at b9d1e66: `npx playwright test tests/export.spec.js --repeat-each=N`: Chromium N=15, 315 passed, 0 failed, 0 flaky, 20.7 min; Firefox N=3, 63 passed, 0 failed, 0 flaky, 4.3 min; WebKit N=3, 63 passed, 0 failed, 0 flaky, 4.5 min. O2 met.
- 2026-11-17 review M1 round 1: 0 blocking, 3 backlog. Finding 1 is backlog #1164 (four spec files, not small).
- 2026-11-17 backlog #1165 into M1 (orchestrator: small, one file the milestone changed).
- 2026-11-17 backlog #1166 into M1 (orchestrator: small, one file the milestone changed).
- 2026-11-17 review M1 round 2 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in, CR #1161 resolved; finding 1 is backlog #1167. M1 ticked; demo pending.
- 2026-11-17 M1 demo (user): go. M1 accepted; no `proposed` ADR exercised.
- 2026-11-17 #1152 O7 baseline at 75dc82c, before any M2 change (Chromium): 100 gallery shots (`SHOTS=1`), `m2-baseline-shots.zip` on the draft `review-assets-2` release (`review-assets` is at GitHub's 1000-asset limit); U14 medians (`PERF=1`): hover spot 2.45 ms, map 0.10 ms; curve 1.30 ms; bars 1.40 ms. O3 to O6: six skipped tests in `tests/interact.spec.js` (O3 has three).
- 2026-11-17 orchestrator: each M2 item unskips its own acceptance test once it is green in all three browsers (#1156, #996 so far), because `.githooks/pre-commit` refuses a source change with no test change; #1159 unskips what is left and checks O7. Wave ends pushed at 636361b, 237a1db, c51e442 (full gate green). #1168 filed: Up/Down carry a drawn-point position, not the data index (out of scope).
