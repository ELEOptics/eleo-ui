# Plan #1175: Data indices past a dropped point, font MIME on export

Status: approved 2026-11-17
Branch: `plan/1175-nan-index-font-mime` PR: #<pr> Depends on: none Roadmap: `agent_docs/roadmap.md`, row T

## Problem

K ([#1144]) left two verified bugs. A curve or spot series with a NaN or infinite point draws it as a gap, and every point after the gap reports an index one too low: a hover's `segment` and the keyboard's Up/Down land on the wrong data point ([#1168]). An exported SVG can embed a font as `data:text/html; charset=utf-8;base64,...` when the font server mislabels it, which non-browser SVG consumers may reject ([#1162]). Both ship in J's major release unless fixed first. With them, two cleanups in the same area: one spec helper ([#1164]) and the limit lines' dash period worked out once ([#1169]).

## Ground truth

- **Why [#1168] needs `curve.js`.** `seriesPath` (`curve.js:46-49`) leaves a bad point out of `d` and starts a new `M`; the zoomed path (`:84-87`) writes `data-from` as the count of finite points before the piece (`base += r.length`). So the markup never holds the dropped point, and `runs()` in `interact.js:7-26` has nothing to count. Hover (`interact.js:76`, `:87`) and the keyboard (`drawnSeries`, `:343`) both use `j + r.off`.
- **Documented and pinned.** `index.d.ts:505` (`HoverEvent.segment`) and `README.md:211` (Hover) say the index is the drawn index among finite points plus `data-from`. `README.md:101` and `curve.test.js:1058-1110` pin `data-from` as a count of finite points, and `interact.spec.js:1763-1790` (oracle CR [#984], CR [#995]) pins `data-from` as one number, a list reading 0. A new `data-skip` attribute leaves all of these true. `index.d.ts` is Core (`CLAUDE.md`).
- **Spot.** `spot.js:79` filters dead points out of its dot path (one `M` per dot, one path per series), so a spot series' Up/Down shifts the same way. `layout2d.js` throws on a non-finite ray point (`:134`, `:169`), so rays are unaffected.
- **[#1162].** `toDataUrl` (`export.js:12-17`, private) uses `readAsDataURL(blob)`, so the data URL carries the response's `Content-Type`. Browsers load a data-URL font whatever its MIME, which is why every test is green today. `export.spec.js:510` ([#1163]) builds a `text/html` font by hand; `page.route` stubs are used at `:531`, `:576`. `README.md:295-298` describes the embedded fonts.
- **[#1164].** Six copies convert polyline `points` to path data before `subpaths`: `interact.spec.js:27`, `:483`, `gallery.spec.js:923`, `zoom-budget.spec.js:33`, `tests/unit/curve.test.js:1044`, `:1095`. `pageHelpers` (`tests/page-helpers.js`) injects helpers from `tests/unit/helpers/svg.js`.
- **[#1169].** `limitMarks` (`limits.js:44-47`) reads the dash back out of `style.line` with a regex, computes the period and a positive modulo, then calls `dashOffset` (`clip.js:42-46`), which computes the period again and returns `""` for `px <= 0` and for `undefined` (a one-point piece has no `cut`, `curve.js:58`, `:80`). `limitStyle` is in `curve.js:145`.
- **Prior art.** No library applies: the MIME fix is one `new Blob([blob], { type })`; the font media types are RFC 8081's `font/woff2`, `font/woff`, `font/ttf`, `font/otf`.
- **Tests.** `npm run test:unit` (node), `npx playwright test` (gallery, three browsers since S). `scripts/check.sh --fast` runs no Playwright. O3's checks are opt-in: `SHOTS=1 SHOTS_BASE=<dir>` (`gallery-shots.spec.js:3-6`) and `PERF=1` (`perf.spec.js:9`); K kept its base PNGs in the `review-assets-2` release.

## Outcomes

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | Points after a dropped point keep their data index, in a hover's `segment` and the keyboard, on curve (single plot, panels, zoomed) and spot. | Given curve series 0 = (0,0) (1,1) (NaN,2) (3,1) (4,0) and series 1 = (i, 2) for i = 0..4, single plot and panels, with and without a `view`: when the pointer hovers between x = 3 and 4, then `segment` is `[3, 4]`; when the current point is series 1 at x = 3 and ArrowUp is pressed, then series 0's point at x = 3 is current. Given a spot of two series of 5 points, series 0's point 2 dead: when the current point is series 1's point 3 and ArrowUp is pressed, then series 0's point 3 is current. | `closed-form: the caller's points array (index i is the i-th entry)` | `tests/interact.spec.js::data index past a dropped point` |
| O2 | An exported font's data URL carries a font MIME whatever the server sent. | Given the gallery's font responses stubbed to `Content-Type: text/html; charset=utf-8` (`page.route`): when `ELEO.standalone` exports the MTF tile, then every embedded `@font-face` url starts `data:font/woff2;base64,` and none `data:text/html`. | `spec: RFC 8081 (font/woff2 for a .woff2 resource)` | `tests/export.spec.js::font MIME from a mislabelled response` |
| O3 | Nothing else moves: every tile's screenshot unchanged; U14 holds for `interact`, including hover and ArrowUp on a 10,000-point spot with 10% dead points. | Given the base shot at the plan's start: when `SHOTS=1 SHOTS_BASE=<base> npx playwright test gallery-shots` runs, then 0 tiles differ; when `PERF=1 npx playwright test perf` runs, then the hover median, the dead-point spot's hover and ArrowUp medians, and its redraw stay under 16 ms. | `fixture: gallery-shots base recorded at the plan's start (#1153)`; `measurement: perf.spec.js median of 20 (U14)` | `tests/gallery-shots.spec.js`, `tests/perf.spec.js` |

## Non-goals

- [#1167] (O1's scan spellings): deferred on the roadmap until a spec uses another spelling.
- [#850], [#997]: their triggers have not fired (roadmap Deferred).
- A font MIME sniffed from the bytes, or a relabel for an unknown extension: an unknown extension keeps the response's MIME, as today (critic 10).
- A minor release note for `segment`: the documented rule was the bug, so a patch changeset (round 2).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#1168] | absorb | O1, items 2-4 |
| [#1162] | absorb | O2, reused as its item |
| [#1164] | absorb | reused as its item; all six copies |
| [#1169] | absorb | reused as its item, with `dashOffset`'s modulo before it (round 1) |
| [#1167] | related | deferred: no spec uses another spelling |
| [#850], [#997] | related | deferred: triggers unfired |

## Constraints and assumptions

- A mark's markup changes only by the new `data-skip` attribute; [#1169] writes the same `stroke-dashoffset`. So no tile's pixels move (O3).
- `data-from` keeps its meaning (one number, a count of finite points), so callers' own marks, layout2D rays and the CR [#984] tests read as before.
- A mark with no `data-skip` (a caller's own path, including one with a NaN pair inside a run) indexes as today: drawn index plus `data-from`.

## Decisions

- ADR-0001 (plot boundary): `data-*` on marks is the hover contract; `data-skip` joins it.
- Core change: `packages/plots/src/index.d.ts`, the doc comment of `HoverEvent.segment` (`:505`): the index becomes the caller's data index, with `data-skip` named. Approved with the plan.

## Milestones

### M1: Data indices and font MIME GitHub: `P1175 M1: Data indices and font MIME`

Demo: a curve with a NaN point hovered between x = 3 and 4 shows `segment [3, 4]`, and ArrowUp from series 1 at x = 3 lands on x = 3, on curve and spot; the MTF tile exported with mislabelled fonts embeds `data:font/woff2`; 0 tiles differ and the U14 medians are logged. Proves: O1, O2, O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| #1176 | O1 and O2 acceptance tests, skipped; O3's base (`SHOTS=1`, PNGs to the `review-assets-2` release) and U14 medians before (`PERF=1`: hover, and a new dead-point spot case: hover, ArrowUp, redraw) | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/interact.spec.js`, `tests/export.spec.js`, `tests/perf.spec.js` | O1, O2 skipped; the base logged in this plan's Change log |  |
| #1177 | `runs()` reads `data-skip`, the sorted data indices of dropped points: a drawn index `i + data-from` becomes its data index by adding 1 for each skipped index at or below it. `<path d="M0,0 L1,1 M3,1 L4,0" data-skip="2"/>` hovered between x = 3 and 4 gives `segment: [3, 4]` | a skip list because `data-from` keeps its approved one-number meaning (CR [#984]) and the markup grows only by the dropped points (user, round 3); considered `data-from` as one number per run (rewrites the approved `interact.spec.js:1790` and writes one number per dot on spot) | `packages/plots/src/interact.js`, `packages/plots/src/index.d.ts`, `packages/plots/README.md` (Hover, `:211`, gains `data-skip`) | `tests/interact.spec.js::data-skip maps a drawn index to its data index` (a leading dropped point, two dropped in a row, a mark without `data-skip` unchanged) | #1176 |
| #1178 | `curve` writes `data-skip` on a series' marks when it dropped a point: single plot, panels, and every zoomed piece (the whole series' list) | forced (`curve.js:46-49`, `:87`: the markup is the only place the dropped point is known); considered writing it only on the pieces after a gap (each piece would need its own list, and `data-from` already places the piece) | `packages/plots/src/curve.js`, `.changeset/data-index-past-gap.md` (patch, curve and spot) | `tests/unit/curve.test.js::data-skip lists the dropped indices` | #1177 |
| #1179 | `spot` writes `data-skip` on a series' path when it dropped a dead point. `(0,0) (1,0) (NaN,0) (3,1) (4,0)` gives `<path d="M0,0 h.01 M1,0 h.01 M3,1 h.01 M4,0 h.01" data-skip="2" …/>` | only when it drops because a spot with no dead point needs nothing (user, round 2); considered always writing it (an empty attribute on every series) | `packages/plots/src/spot.js` | `tests/unit/spot.test.js::data-skip when a point drops` | #1177 |
| [#1162] reuse | `toDataUrl` retypes a non-`font/*` response to the font type of its URL's extension (`.woff2`, `.woff`, `.ttf`, `.otf`, ignoring a query string); a `font/*` response or an unknown extension keeps its MIME | a Blob retype because the bytes are already right and only the label is wrong; considered sniffing the woff2 magic bytes (more code, and every gallery face has an extension) | `packages/plots/src/export.js`, `packages/plots/README.md` (`:295-298` gains the MIME rule), `.changeset/font-mime.md` (patch) | `tests/export.spec.js::toDataUrl font MIME` (a `font/*` response kept, a query string, an unknown extension kept) | #1176 |
| [#1164] reuse | one `pointsOf` helper replaces the six polyline conversions | forced ([#1164]: the conversion is a no-op `subpaths` already covers) | `tests/unit/helpers/svg.js`, `tests/page-helpers.js` (and the six sites) | `tests/unit/spec-helpers.test.js::pointsOf` | #1176, #1178 |
| #1180 | `dashOffset` takes the positive modulo for any finite px; a non-finite px still gives `""` (serves [#1169], guarded by O3) | forced ([#1169]'s sketch: limitMarks then passes its raw offset); considered keeping the `px > 0` guard (limitMarks would keep its own modulo) | `packages/plots/src/clip.js` | `tests/unit/clip.test.js::dashOffset of a negative or missing offset` | #1176 |
| [#1169] reuse | `limitStyle` returns `dash`; `limitMarks` reads it and drops its regex and period step (guarded by O3) | forced ([#1169], user round 2: as the issue says) | `packages/plots/src/limits.js`, `packages/plots/src/curve.js` | `tests/unit/limits.test.js::limit dash from limitStyle` (new file, `oracle:` line): `limitStyle().dash === '6 3 1 3'`, and `limitMarks` given `{ line: 'stroke="x"', dash: '6 4' }` with a cut writes the offset (red today: the regex finds nothing) | #1178, #1180 |
| #1181 | Unskip O1 and O2; check O3 (`SHOTS=1 SHOTS_BASE=<base> npx playwright test gallery-shots`, `PERF=1 npx playwright test perf`) and log the medians | forced (`workflow.md`, TDD: the last item unskips them) | `tests/interact.spec.js`, `tests/export.spec.js`, this plan's Change log | O1, O2, O3 | all above |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| A caller's mark already carries a `data-skip` attribute | it would now shift that mark's indices | none known; the README names the attribute |
| Firefox or WebKit parse a dropped-point path differently | O1 differs by browser | O1 runs in all three browsers (S) |
| Reading `data-skip` on every pointer move slows a hover | U14 misses on spot | O3 measures hover and ArrowUp on a 10,000-point spot with 10% dead points |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-17 round 1 (user): buckets confirmed, and [#1169] taken in too; `data-from` holds one number per run; spot included; one milestone.
- 2026-11-17 round 2 (user): spot writes its index data only when it drops a point; [#1169] as the issue says; pre-mortem: nothing more (patch changesets).
- 2026-11-17 critique (general-purpose, claude-fable-5-1): 15 findings. Accepted 3-13 and 15. 1, 2 and 14 moot after round 3 (`data-from` keeps its meaning, so no pinned test changes and one mark per run is no longer weighed). The Approach finding on item 2 (a `data-skip` list) was contested and put to the user.
- 2026-11-17 round 3 (user): `data-skip` (the dropped data indices) in place of a `data-from` list.

[#1144]: https://github.com/ELEOptics/eleo-ui/issues/1144
[#1162]: https://github.com/ELEOptics/eleo-ui/issues/1162
[#1163]: https://github.com/ELEOptics/eleo-ui/issues/1163
[#1164]: https://github.com/ELEOptics/eleo-ui/issues/1164
[#1167]: https://github.com/ELEOptics/eleo-ui/issues/1167
[#1168]: https://github.com/ELEOptics/eleo-ui/issues/1168
[#1169]: https://github.com/ELEOptics/eleo-ui/issues/1169
[#850]: https://github.com/ELEOptics/eleo-ui/issues/850
[#984]: https://github.com/ELEOptics/eleo-ui/issues/984
[#995]: https://github.com/ELEOptics/eleo-ui/issues/995
[#997]: https://github.com/ELEOptics/eleo-ui/issues/997
- 2026-11-17 approved (user): published as plan #1175, milestone P1175 M1, items #1176 to #1181 with #1162, #1164 and #1169 reused.
