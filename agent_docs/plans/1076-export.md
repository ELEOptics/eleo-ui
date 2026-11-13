# Plan #1076: Export a plot as SVG and PNG

Status: approved 2026-11-13
Branch: `plan/1076-export` PR: [#1088] Depends on: none Roadmap: `agent_docs/roadmap.md`, row I

## Problem

A user who wants a plot in a paper, a slide or an issue can only screenshot it today. The SVG the renderers
return needs ELEO's CSS (tokens, `plots.css`) and the Fira fonts the page loaded, so saved as-is it draws
unstyled and in a fallback font. U15 asks for a standalone SVG and a PNG at a chosen scale, with no new
dependency; the caller owns the button.

## Outcomes

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | `standalone(svg)` returns a self-contained SVG string of what the plot draws now: computed styles inlined for the current theme, the Fira faces its text uses embedded as `@font-face` data URLs, no hover marks, the current `view`, on a background rect of the tile's computed `--surface` (user, approval). | Given every SVG gallery tile (`[data-svg], [data-map]`; one zoomed, one hovered) in Chromium, Firefox and WebKit, when `standalone` runs and the string is drawn as an `<img>` in a page with no ELEO CSS and font requests blocked, then it matches the on-screen tile's plot area (a `screenshot()`, both decoded in-page with `createImageBitmap` and `getImageData`, as `map2d.spec.js:20` reads a canvas; no new dependency) within 1% of pixels (a pixel differs when a channel differs by more than 16, CR [#1089]), and every (family, weight, style) its text uses has an embedded face that loads as a `FontFace` there | `property: U15's 1% pixel rule`; `property: every used face embedded and loadable with the network blocked` (user, round 1) | `tests/export.spec.js::standalone matches` |
| O2 | `png(svg, { scale })` resolves a PNG `Blob` of the plot's size times `scale`. | Given the same tiles, when `png` runs at scale 1 and 2, then its size is the plot's size times the scale and its pixels match the standalone SVG drawn at that scale within 1% | `property: U15's size rule`; `property: pixels match the standalone SVG at that scale within 1%` (user, round 1) | `tests/export.spec.js::png size and pixels` |
| O3 | The gallery's MTF tile saves itself as SVG and PNG from buttons in a new `.eleo-plot__actions` div in its `.eleo-plot__hd` (the class `PlotCard`'s `actions` snippet renders and `plots.css:111` styles; `PlotCard` unchanged). | Given the gallery, when the tile's SVG and PNG ×2 buttons are clicked, then the downloaded SVG equals `standalone()`'s string and the PNG's IHDR size is twice the plot's | `property: the downloads equal O1's and O2's outputs`; `user: the tile in both themes and palettes` | `tests/export.spec.js::gallery save` |

## Non-goals

- A `theme` option (user, round 1): cut, because typed `map2D` bakes its cells at draw time, so a resolve-only theme switch would export dark cells in a light frame. The caller redraws in a light container (`PlotCard`'s `paper`, or `data-theme="light"`) and exports that; the README says so.
- U15's canvas clause (user, round 2): dropped from U15 at publish; `layout3D` is J's, and a `<canvas>` already has `toBlob`.
- saveSvgAsPng as a dependency: last released 2019, and we need only its style and font inlining (about 80 lines here). ADR-0004 names export as the point to weigh a library; this weighs it and says no.
- Server-side or headless export, phos's save dialog, the button in `PlotCard` itself.
- Legend placement outside the tile ([#534]).

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#534] | related | Legend outside a tile's footer: waits for phos; an export draws the in-SVG keys (R) and nothing outside the SVG |
| [#1007] | absorb | M1, reused as a work item: plots 0.10.0 published 2026-11-13 by PR [#676]'s release |

No open issue tracks export itself.

## Constraints and assumptions

- The gallery loads Fira from Google Fonts. Its stylesheet is cross-origin, so `cssRules` is readable only with `crossorigin="anonymous"` on the `<link>`; the gallery gains it, and the README tells consumers the same. `fonts.gstatic.com` serves the woff2 files with CORS.
- Google Fonts splits each face by `unicode-range`; `standalone` embeds only the subsets whose range covers characters its text uses. Measured 2026-11-13: the latin subsets are 23.7 KB (Fira Code 400, 500) and 17.5-17.8 KB (Fira Sans 400, 500, 600) as woff2, so a typical export (mono 400, sans 400 and 500) is about 59 KB, 79 KB as base64: under the kill criterion's 100 KB, with little margin.
- The plan branch is cut from `origin/main` (8105855, plots 0.10.0), not the local `main`.
- `check.sh --fast` runs no Playwright, so every item that changes `export.js` or the gallery also runs `npx playwright test tests/export.spec.js` before it is done.
- Hover marks are `div`s on the host (`interact.js:113-115`), outside the SVG, so they cannot leak; the hovered-tile test checks it.
- `standalone` is async (it fetches fonts). The tests need the network for Google Fonts, as the gallery tests do already.

## Decisions

- No new ADR: ADR-0004's revisit trigger is answered in Non-goals (no library).
- Core: `packages/plots/src/index.d.ts` gains `standalone` and `png`. No `exports` change (both come from `.`).

## Milestones

### M1: `standalone` and `png` on one tile in three browsers GitHub: `P1076 M1: standalone SVG and PNG`

Demo: on the MTF tile, `await ELEO.standalone(svg)` returns a string that, saved as `mtf.svg`, renders like the tile in Fira in all three browsers; `await ELEO.png(svg, { scale: 2 })` returns a `Blob` of type `image/png` twice the plot's size. The Change log lists every SVG tile's embedded font bytes. Proves: O1 and O2 on one tile, the kill criterion measured on every tile.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1077] | O1 and O2 acceptance tests for the MTF tile, skipped, with the in-page pixel comparison helper | forced (`workflow.md`, TDD: the first item writes them skipped); the comparison decodes both images in-page with `createImageBitmap` and `getImageData` because the repo already reads pixels that way (`map2d.spec.js:20`); considered `pixelmatch` and `pngjs`, a new dependency (the user's) for a count of differing pixels | `tests/export.spec.js` | `standalone matches`, `png size and pixels` (skipped) |  |
| [#1078] | Inline computed styles | a clone of the SVG with each element's computed longhands (`fill`, `stroke`, its width, dasharray and linecap, `opacity`, `font-family`, `font-size`, `font-weight`, `font-style`, `font-variant-numeric`, `text-anchor`, `dominant-baseline`, `paint-order`, `image-rendering`) as a `style` attribute, a first-child background rect, `xmlns` and px `width`/`height`, because Inkscape, PowerPoint and rsvg do not resolve `var()`, so only resolved values travel; considered resolving the referenced custom properties onto the root with a three-rule `<style>`, smaller but unportable. Longhands because a computed `font` shorthand serialises empty under `tabular-nums` (`plots.css:127-128`). `ELEO.standalone(svg, { fonts: false })` until item 3 | `packages/plots/src/export.js`, `packages/plots/src/index.js` | `export.spec.js::styles resolve without ELEO CSS` | [#1077] |
| [#1079] | Embed the used fonts | each readable `@font-face` rule (a sheet whose `cssRules` throws is skipped in a try/catch and its families named in one `console.warn`) kept when its family, weight and style match the clone's text and its `unicode-range` covers one of its characters, then its `rule.cssText` with each `url()` swapped for the fetched data URL, because reusing `cssText` builds no `font-family:` string (the style lint, `style-lint.test.js:48-56`, flags one) and the filter is the smallest faithful set (Constraints); considered embedding every face, about 400 KB. The gallery's Google Fonts `<link>` and its preconnect get `crossorigin="anonymous"` | `packages/plots/src/export.js`, `gallery/index.html` | `export.spec.js::used faces embedded` | [#1078] |
| [#1080] | `png(svg, { scale = 1 })` | forced (U15 names `canvas.toBlob`): `standalone`, the string as a Blob URL into an `Image`, `await img.decode()` before `drawImage` on a canvas of the size times `scale` (WebKit can fire `onload` before data-URL fonts are ready), then `toBlob('image/png')`. Tested first on a map tile in WebKit: a canvas taint stops and escalates (user, round 2) | `packages/plots/src/export.js`, `packages/plots/src/index.js` | `export.spec.js::png size and pixels` | [#1079] |
| [#1081] | Types for `standalone` and `png` | forced (Core: `index.d.ts` is the public contract): `standalone(svg: SVGSVGElement, o?: { fonts?: boolean }): Promise<string>`, `png(svg: SVGSVGElement, o?: { scale?: number; fonts?: boolean }): Promise<Blob>`, compiled by a new `types.test.js` case with `--lib es2022,dom` as the map2D case | `packages/plots/src/index.d.ts`, `tests/unit/types.test.js` | `tests/types/export.ts` (tsc) | [#1080] |
| [#1082] | README Export section and changeset | forced (`CLAUDE.md`: a changeset per user-facing change; `workflow.md`, Docs: the README owns the API): the two calls and their output, the `crossorigin` note, and the light-theme recipe (redraw under `data-theme="light"` or `PlotCard`'s `paper`, then export); a plots minor changeset | `packages/plots/README.md`, `.changeset/export.md` | `tests/unit/headers.test.js::README documents export` (a new case: the section names both calls and the light-theme recipe) | [#1080] |
| [#1007] reuse | plots-svelte peers `"@eleoptics/plots": ">=0.10.0 <1"` | forced ([#1007]: the wrappers import `interact`, first in plots 0.10.0, on npm since PR [#676]; [#598]'s precedent): the peer, the lock's peer line, `release.test.js` (lines 383, 457) renamed and raised, a plots-svelte patch changeset | `packages/plots-svelte/package.json`, `package-lock.json`, `.changeset/svelte-peer.md` | `tests/unit/release.test.js::plots-svelte peers plots >=0.10.0` |  |
| [#1090] | The export tests count a channel difference above 16 and align the tile screenshot to the pixel grid (CR [#1089]) | one constant for both comparisons because CR [#1089] measured Firefox's inline-versus-`<img>` anti-aliasing at 1.09% under > 8 and 0.84% under > 16 with equal ink; considered a 2% budget, which gives a real defect twice the room. A shared `tileShot` helper (`position:relative` offset, then a `page.screenshot` clip) because `svg.screenshot()` rounds a fractional box one pixel taller and [#1084] needs the same; considered a `translate` offset, measured at 2.7-3.6% | `tests/export.spec.js` | `standalone matches` (a temporary unskipped run) | [#1082] |
| [#1083] | Unskip O1 and O2 for the MTF tile; log every SVG tile's embedded font bytes in the Change log | forced (`workflow.md`, TDD: the last item unskips them); the bytes for every tile because the kill criterion is per export | `tests/export.spec.js` | `standalone matches`, `png size and pixels` | all above |

### M2: every tile and the gallery's save buttons GitHub: `P1076 M2: every tile and save`

Demo: `npm run gallery`, the MTF tile's SVG and PNG ×2 buttons download files that open like the tile, in both themes and palettes; every SVG tile passes O1 and O2 in three browsers. Proves: O1 and O2 on every tile, O3.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1084] | O1 and O2 over every SVG tile (one zoomed, one hovered), and O3, skipped | forced (`workflow.md`, TDD) | `tests/export.spec.js` | `standalone matches (every tile)`, `png size and pixels (every tile)`, `gallery save` (skipped) | M1 |
| [#1085] | Every SVG tile through `standalone` and `png` | unskip the every-tile tests and fix what they find in `export.js` (a property missing from the list, `map2D`'s `<image>`); a tile over the 1% rule that needs a renderer change stops and is reported | `packages/plots/src/export.js`, `tests/export.spec.js` | `standalone matches (every tile)`, `png size and pixels (every tile)` | [#1084] |
| [#1086] | The gallery's save buttons | buttons `SVG` and `PNG ×2` (`.eleo-btn--sm`) in a new `.eleo-plot__actions` div in the MTF tile's `.eleo-plot__hd`, and a five-line `download(blob, name)` in the gallery, because the caller owns the button (row I); considered a `download` helper in the package, which phos would replace with its own dialog | `gallery/index.html` | `export.spec.js::gallery save` | [#1085] |
| [#1087] | Unskip O3 | forced (`workflow.md`, TDD) | `tests/export.spec.js` | `gallery save` | all above |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| WebKit taints a canvas that draws an SVG holding a data-URL `<image>` (typed `map2D`), so `toBlob` throws | O2 fails for maps in WebKit | item 4 tests a map tile in WebKit first; if it throws, stop and escalate (user, round 2) |
| WebKit draws an SVG image before its embedded fonts load | a PNG in a fallback font (the kill criterion) | item 4 awaits `img.decode()`; O2's pixel rule on the MTF tile in M1 catches it |
| Embedded fonts exceed 100 KB (greek subset for μ, a fourth weight) | kill criterion | item 8 logs the bytes of every SVG tile in M1; over 100 KB is the kill criterion's ask |
| A consumer's font stylesheet is unreadable (no `crossorigin`) | export falls back | `console.warn` names the families; README note |

## Change log

- 2026-11-13 draft: ground truth read; no Director line in `CLAUDE.md`, so no row pin.

- 2026-11-13 round 1 (user): issues: "Check again. 0.10.0 should be on npm". PR [#676] merged 15:49; the Release job published plots 0.10.0, plots-svelte 0.6.0 and tokens 0.3.0 at 15:50:57; the registry still served 0.9.0 at 15:54 (propagation). [#1007] proposed absorbed.

- 2026-11-13 round 1 (user): theme option cut, the light-redraw recipe documented.

- 2026-11-13 round 1 (user): font check added to O1: every used face embedded and loadable with the network blocked.

- 2026-11-13 round 1 (user): O2 compares pixels as well as size.

- 2026-11-13 round 2 (user): [#1007] absorbed as M1 item 4; U15's canvas clause dropped; a WebKit canvas taint on maps stops and escalates rather than a pre-planned fallback.

- 2026-11-13 critique (general-purpose, claude-fable-5-2): 13 findings, all applied: font longhands (1); background put to the user (2); `rule.cssText` reuse against the style lint (3); `png` moved into M1 with `img.decode()` (4); M1 gets its types, README and changeset (5, 10); font bytes logged for every tile (6); the every-tile tests unskipped by the item that fixes them, SVG tiles defined as `[data-svg], [data-map]` (7); O3 names the gallery's new actions div (8); [#1007]'s files and the `origin/main` base (9); in-page pixel decoding, no new dependency (11); the try/catch, preconnect and Playwright-per-item gaps (12); Approach cells reworded: portability as item 2's reason, item 4 forced, O3 compares downloads to the outputs (13). None rejected.

- 2026-11-13 approval (user): the export draws a background rect in the tile's computed `--surface`; plan approved.

- 2026-11-13 CR [#1089] (user): accepted, tolerance > 16 with the 1% budget unchanged. O1's pixel rule failed in Firefox only (1.09%, edge anti-aliasing, equal ink); new item [#1090] before [#1083].

[#1007]: https://github.com/ELEOptics/eleo-ui/issues/1007
[#1076]: https://github.com/ELEOptics/eleo-ui/issues/1076
[#1077]: https://github.com/ELEOptics/eleo-ui/issues/1077
[#1078]: https://github.com/ELEOptics/eleo-ui/issues/1078
[#1079]: https://github.com/ELEOptics/eleo-ui/issues/1079
[#1080]: https://github.com/ELEOptics/eleo-ui/issues/1080
[#1081]: https://github.com/ELEOptics/eleo-ui/issues/1081
[#1082]: https://github.com/ELEOptics/eleo-ui/issues/1082
[#1083]: https://github.com/ELEOptics/eleo-ui/issues/1083
[#1084]: https://github.com/ELEOptics/eleo-ui/issues/1084
[#1085]: https://github.com/ELEOptics/eleo-ui/issues/1085
[#1086]: https://github.com/ELEOptics/eleo-ui/issues/1086
[#1087]: https://github.com/ELEOptics/eleo-ui/issues/1087
[#1088]: https://github.com/ELEOptics/eleo-ui/pull/1088
[#1089]: https://github.com/ELEOptics/eleo-ui/issues/1089
[#1090]: https://github.com/ELEOptics/eleo-ui/issues/1090
[#534]: https://github.com/ELEOptics/eleo-ui/issues/534
[#598]: https://github.com/ELEOptics/eleo-ui/issues/598
[#676]: https://github.com/ELEOptics/eleo-ui/issues/676
