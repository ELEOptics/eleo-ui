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
| O1 | `standalone(svg)` returns a self-contained SVG string of what the plot draws now: computed styles inlined for the current theme, the Fira faces its text uses embedded as `@font-face` data URLs, no hover marks, the current `view`, on a background rect of the tile's computed `--surface` (user, approval). | Given every SVG gallery tile (`[data-svg], [data-map]`; one zoomed, one hovered) in Chromium, Firefox and WebKit, when `standalone` runs and the string is drawn as an `<img>` in a page with no ELEO CSS and font requests blocked, then it matches the on-screen tile's plot area (a `screenshot()`, both decoded in-page with `createImageBitmap` and `getImageData`, as `map2d.spec.js:20` reads a canvas; no new dependency) within 1% of pixels (a pixel differs when a channel differs by more than 16, CR [#1089]), within 0.5% under that exact rule (CR [#1119]), and every (family, weight, style) its text uses has an embedded face that loads as a `FontFace` there | `property: U15's pixel rule, exact at 0.5% (CRs [#1116], [#1119])`; `property: every used face embedded and loadable with the network blocked` (user, round 1) | `tests/export.spec.js::standalone matches` |
| O2 | `png(svg, { scale })` resolves a PNG `Blob` of the plot's size times `scale`. | Given the same tiles, when `png` runs at scale 1 and 2, then its size is the plot's size times the scale and at scale 1 its pixels match the standalone SVG within 0.5% exact (CR [#1119]), and at scale k the PNG box-averaged to 1× matches a tile screenshot taken at deviceScaleFactor k and box-averaged the same way within 1% outside the text's boxes, where a pixel matches when one within 1 px is within the channel tolerance (CR [#1104], text masked by CR [#1112], DPR-k reference by CR [#1116]) | `property: U15's size rule`; `property: at scale 1, pixels match the standalone SVG within 0.5% exact; at scale k, the PNG box-averaged to 1× matches the DPR-k tile box-averaged to 1× within 1% outside text` (user, round 1; CRs [#1104], [#1112], [#1116], [#1119]) | `tests/export.spec.js::png size and pixels` |
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

Done 2026-11-13: review round 11 (Review M1: 0 blocking, nothing pulled in); full gate green on 0fe7366 (475 passed); CI pending on 0fe7366 at the tick (it carries CR [#1112]'s Linux Chromium check). Reopened once, after round 5, for CR [#1102]. Demo: go (user, 2026-11-13).

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
| [#1092] | Export docs say what is tested: browsers draw the embedded Fira, other apps use installed fonts (CR [#1091]) | forced (CR [#1091], review M1 round 1: the Inkscape, PowerPoint and rsvg claims are untested, and those apps don't load `@font-face`); the README and the `standalone` doc comment | `packages/plots/README.md`, `packages/plots/src/index.d.ts`, `tests/unit/headers.test.js` | `headers.test.js::README documents export` | [#1083] |
| [#1093] | `standalone` finds faces in `@import`, `@layer` and `@media`, and warns for every used family left without one | recurse into `rule.styleSheet` and `rule.cssRules` because consumers load Google Fonts by CSS `@import` and layer their CSS (review M1, finding 2); considered documenting top-level rules only, which breaks the README's warn promise | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::nested and unmatched faces` | [#1092] |
| [#1094] | `standalone` matches keyword weights and family names in any case | `normal` as 400 and `bold` as 700, families lowercased, as CSS matches them (review M1, finding 3); considered numeric weights only, which drops hand-written desktop faces | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::keyword weights and family case` | [#1093] |
| [#1095] | `standalone` skips a font that fails to fetch and warns | throw on `!res.ok`, then catch per rule because one bad face should not fail the export (review M1, finding 4); considered failing the whole call, which the README's fallback promise rules out | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::failed font fetch` | [#1094] |
| [#1096] | `png` at scale 1 matches the on-screen tile within 1% | compare with `tileShot` because the reference image is built the way `png` builds its own, so a font-load race would hit both (review M1, finding 5); considered correcting the risk row instead | `tests/export.spec.js` | `export.spec.js::png size and pixels` | [#1095] |
| [#1097] | `standalone` drops `stop-color` and `stop-opacity` | no renderer draws a gradient, so they only add declarations (review M1, finding 7); considered keeping them for a future gradient, which can add them back | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::styles resolve without ELEO CSS` | [#1096] |
| [#1099] | `standalone`'s warning skips generic families and names partly embedded ones; `inWeight`'s dead branch goes | one item for review M1 round 2's findings 1-3 because they touch the same lines; generic keywords left out because they never have an `@font-face`; considered warning on them, which every system-font consumer would see on each export | `packages/plots/src/export.js`, `tests/export.spec.js`, `tests/unit/style-lint.test.js` | `export.spec.js::warning names only missing faces` | [#1097] |
| [#1100] | `standalone`'s warning leaves out `-apple-system` and `BlinkMacSystemFont` | added to `GENERIC` because they are vendor system-font names with no `@font-face`, and the common GitHub-style stack starts with them (review M1 round 3, finding 1); considered skipping every family that starts with a hyphen, which is broader than the evidence | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::warning names only missing faces` | [#1099] |
| [#1101] | The warning test pins `BlinkMacSystemFont` as the first family | a second call with it first, because `embedFonts` reads only the first family, so the `-apple-system` stack never reached it (review M1 round 4, finding 1); considered reading every family in the stack, which changes behaviour for one test | `tests/export.spec.js` | `export.spec.js::warning names only missing faces` | [#1100] |
| [#1103] | `png` at scale k draws strokes k times as wide (CR [#1102]) | `png` lays the clone out at box × scale (viewBox kept), multiplies only the `non-scaling-stroke` elements' `stroke-width`, `stroke-dasharray` and `stroke-dashoffset` by scale, and draws the image at its own size, because a scaled `drawImage` keeps those strokes at screen width in Chromium and Firefox; considered baking group transforms into points in `standalone`, which reorders elements and throws on other tags. `standalone`'s output is unchanged. The test follows CR [#1104] | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::png size and pixels` | [#1101] |
| [#1107] | Export tests: `tileShot` idempotent, O2's `oracle:` line per CR [#1104], the standalone diff at scale 1 only (CRs [#1105], [#1106]) | add the correction to the current offset because the second call reset `top` to 0 and blurred the scale-2 reference (review M1 round 6); considered one shot reused for both scales, which hides the bug from later callers such as [#1084] | `tests/export.spec.js` | `export.spec.js::tileShot is idempotent`, `png size and pixels` | [#1103] |
| [#1108] | `png` scales only px or unitless non-scaling strokes | leave `%` and `em` values as they are because `parseFloat` then `px` gets both number and unit wrong (review M1 round 6, finding 3); considered resolving them to px, which needs the element's font size and viewport | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::png scales px strokes only` | [#1107] |
| [#1110] | `png`: dashoffset px-gated, header comment per CR [#1109], test awaits its promise and skips the unused scale-2 build | one item for review M1 round 7's four findings because they touch the same lines; the dashoffset goes through `PX` like its siblings; considered leaving it, since `clip.js` writes px only | `packages/plots/src/export.js`, `tests/export.spec.js` | `export.spec.js::png scales px strokes only` | [#1108] |
| [#1111] | `png scales px strokes only`'s oracle comment names `stroke-dashoffset` | forced (review M1 round 8: #1110 asserts the dashoffset, but the oracle line names only width and dasharray) | `tests/export.spec.js` | `export.spec.js::png scales px strokes only` | [#1110] |
| [#1113] | O2's scale-k check leaves text out (CR [#1112]) | forced (CR [#1112], the user): Linux Chromium draws on-screen text with subpixel AA and hinted widths that a canvas never matches (text 0.92%, the rest 0.22%); text against the tile stays covered at 1× by O1 | `tests/export.spec.js` | `export.spec.js::png size and pixels` | [#1111] |
| [#1115] | Export tests: O2's oracle lines name the text mask (CR [#1114]), `nearFraction`'s size path returns `{ d, masked }`, the masked share bounded below 10% | one item for review M1 round 10's three findings because they touch the same test; a 10% bound because the measured share is 5.5-6.4%, which leaves room for a theme or font change; considered asserting the share per tile, which belongs to [#1084] | `tests/export.spec.js` | `export.spec.js::png size and pixels` | [#1113] |

### M2: every tile and the gallery's save buttons GitHub: `P1076 M2: every tile and save`

Demo: `npm run gallery`, the MTF tile's SVG and PNG ×2 buttons download files that open like the tile, in both themes and palettes; every SVG tile passes O1 and O2 in three browsers. Proves: O1 and O2 on every tile, O3.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1084] | O1 and O2 over every SVG tile (one zoomed, one hovered), and O3, skipped | forced (`workflow.md`, TDD) | `tests/export.spec.js` | `standalone matches (every tile)`, `png size and pixels (every tile)`, `gallery save` (skipped) | M1 |
| [#1117] | Export tests: O2's scale-k reference is a DPR-k tile shot box-averaged to 1×; O1 and O2 at scale 1 use the 1-px neighbourhood match (CR [#1116]) | forced (CR [#1116], the user: option `compare`): a 1× on-screen raster of thin slanted strokes carries about 11% more ink than exact coverage, so both sides of the scale-k check are exact-coverage rasters; the neighbourhood match for O1 because Chromium's `<img>` raster differs from its DOM raster by 1.0-1.4% on dots and text edges with an inline clone at 7 pixels; considered a 2% budget, which gives a real defect twice the room | `tests/export.spec.js` | `png size and pixels (every tile)` (a temporary unskipped run) | [#1084] |
| [#1120] | Export tests: rounded scroll, Chromium-only wheel scaling, whole-pixel viewBox, exact rule at 0.5% (CR [#1119]) | forced (CR [#1119], the user: an exact rule at 0.5%, because the 1-px neighbourhood passed an injected 1-px shift and a 1.25× stroke at 0.51% or less); the scroll, wheel and viewBox fixes because CR [#1119]'s spike traced every remaining O1 miss to them; considered a 2-px neighbourhood, which is weaker still | `tests/export.spec.js` | `export.spec.js::pixel rule catches a 1-px shift and a 1.25x stroke` | [#1117] |
| [#1121] | Dots draw once in WebKit: a non-zero round-cap dot in place of `h0` (CR [#1119]) | forced (CR [#1119], the user: the renderer fix): WebKit paints a zero-length round-cap subpath twice on screen under `stroke-opacity` (coverage 0.75 against 0.5) and once on a canvas; considered exempting WebKit dot tiles in the test, which leaves the on-screen dots too dark | `packages/plots/src/spot.js`, `packages/plots/src/curve.js`, `packages/plots/src/interact.js`, their unit tests, `.changeset/webkit-dots.md` | a WebKit dot-ink case | [#1117] |
| [#1085] | Every SVG tile through `standalone` and `png` | unskip the every-tile tests and fix what they find in `export.js` (a property missing from the list, `map2D`'s `<image>`); a tile over the 1% rule that needs a renderer change stops and is reported | `packages/plots/src/export.js`, `tests/export.spec.js` | `standalone matches (every tile)`, `png size and pixels (every tile)` | [#1084], [#1117], [#1120], [#1121] |
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

- 2026-11-13 #1083 font bytes (kill criterion, `ELEO.standalone` on every SVG tile, `[data-svg] > svg` and `[data-map] > svg`, light and dark identical; 23 tiles per theme): 19 tiles embed one face (Fira Code 400 latin), about 48 KB base64 / 36 KB woff2, the 4 map tiles among them. `layout2D-fan`, `seidel` and `seidel-terms` embed two (latin plus greek 18.4 KB base64 / 13.8 KB woff2), 66.8 KB base64 / 50.1 KB woff2. `icons` has no text and embeds none. The largest is 66.8 KB, under the 100 KB ask.
- 2026-11-13 review M1 round 1 (code-reviewer, claude-opus-5-5): 1 blocking, filed as CR [#1091] and accepted by the orchestrator (a doc-comment wording fix in Core, no signature change), item [#1092]. Backlog findings 2, 3, 4, 5 and 7 are small and named in files M1 changed, so they are pulled in as [#1093]-[#1097]. Finding 6 (shared test helpers) stays [#1098], for [#1084].
- 2026-11-13 review M1 round 2 (code-reviewer, claude-opus-5-5): 0 blocking, CRs [#1089] and [#1091] resolved; three small backlog findings in `export.js` pulled in as one item [#1099].
- 2026-11-13 review M1 round 3 (code-reviewer, claude-opus-5-5): 0 blocking. Finding 1 (vendor system-font names) pulled in as [#1100]. Finding 2: the [#1099] row's Files gains `tests/unit/style-lint.test.js`, its U5 exemption.
- 2026-11-13 review M1 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, one test-only finding pulled in as [#1101]. Per round, blocking plus pulled in: 6, 3, 1, 1.
- 2026-11-13 review M1 round 5 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. Per round, blocking plus pulled in: 6, 3, 1, 1, 0. M1 ticked; demo pending.
- 2026-11-13 orchestrator, preparing the M1 demo: `png` at scale 2 draws `non-scaling-stroke` curves at half weight (O2's test compares against the same scaled draw). CR [#1102] accepted (a defect inside plan scope), item [#1103]; M1 reopened.
- 2026-11-13 CR [#1104] (user): accepted option (a). At scale k, O2 compares the PNG box-averaged to 1× with the on-screen tile, using a 1-px neighbourhood match. The first [#1103] attempt baked transforms into points; it was re-scoped to a `png`-only fix.
- 2026-11-13 review M1 round 6 (code-reviewer, claude-opus-5-5): 2 blocking. CR [#1105] (`tileShot` not idempotent; #1103's 'WebKit snaps' reason measured that blur) and CR [#1106] (stale O2 oracle text in the test and U15), both accepted by the orchestrator. U15's oracle in the roadmap gains the user's CR [#1104] clause. Items [#1107] (with backlog finding 4) and [#1108] (backlog finding 3).
- 2026-11-13 review M1 round 7 (code-reviewer, claude-opus-5-5): 1 blocking (CR [#1109], a stale comment, accepted) and 3 backlog. The breaker tripped. Per round, blocking plus items pulled in: 6, 1, 1, 1, 0, 3, 4 (rounds 2-4 were miscounted as findings, 3, 1, 1, so the breaker should already have tripped at round 4). The user answered 'continue'; all four findings go in item [#1110].
- 2026-11-13 review M1 round 8 (code-reviewer, claude-opus-5-5): 0 blocking, all seven carried CRs resolved. One P3 comment finding pulled in as [#1111]. Count 1, down from 4.
- 2026-11-13 review M1 round 9 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. CI was red on 69fa4c1 and 2732a9d: Linux Chromium's scale-2 check at 1.14%. CR [#1112], investigated in Playwright's Linux image: the excess is all text (subpixel AA, hinted widths), and the export is right. The user chose to mask text at scale k; item [#1113].
- 2026-11-13 review M1 round 10 (code-reviewer, claude-opus-5-5): 1 blocking, CR [#1114] (O2's oracle lines omit the text mask), accepted by the orchestrator; backlog findings 2 and 3 pulled into the same item [#1115]. All eight carried CRs resolved. Per round, blocking plus pulled in: round 9 0, round 10 2.
- 2026-11-13 review M1 round 11 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in, CR [#1114] resolved. M1 ticked; demo pending.
- 2026-11-13 M1 demo (user): go. No proposed ADR exercised. M2 starts.
- 2026-11-14 CR [#1116] (user): accepted, option `compare`. The #1085 worker found O2's scale-2 check missing 1% on layout2D-fan, -cassegrain and -cassegrain-dead-hidden (1.05-1.45%): the 1× on-screen raster of thin slanted strokes has about 11% more ink than exact coverage, and the export is right. O2 at scale k now compares against a DPR-k tile shot box-averaged to 1×, the 1% budget kept; O1 and O2 at scale 1 take the 1-px neighbourhood match. Item [#1117] before [#1085]; #1085's first attempt was discarded, its diff kept on the CR. U15's oracle in the roadmap gains the clause.
- 2026-11-14 #1117: done; a rare Chromium face-load flake in `standalone matches` filed as [#1118].
- 2026-11-14 CR [#1119] (user): accepted. #1085's second attempt still missed 1% on dense dot and line tiles (Firefox layout2D-cassegrain 5.7%). A spike traced each miss: a half-pixel scroll in Firefox, #1117's wheel scaling (Chromium only divides by DPR), fractional-height tiles meet-scaled in `<img>` and stretched by `png`'s `preserveAspectRatio="none"`, and WebKit painting zero-length round-cap dots twice on screen. The user chose the renderer fix ([#1121]) and an exact rule at 0.5% for O1 and O2 at scale 1 ([#1120]: the 1-px neighbourhood passed an injected 1-px shift and a 1.25× stroke). `png`'s whole-pixel viewBox goes in [#1085], after both. U15's oracle in the roadmap follows.

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
[#1091]: https://github.com/ELEOptics/eleo-ui/issues/1091
[#1092]: https://github.com/ELEOptics/eleo-ui/issues/1092
[#1093]: https://github.com/ELEOptics/eleo-ui/issues/1093
[#1094]: https://github.com/ELEOptics/eleo-ui/issues/1094
[#1095]: https://github.com/ELEOptics/eleo-ui/issues/1095
[#1096]: https://github.com/ELEOptics/eleo-ui/issues/1096
[#1097]: https://github.com/ELEOptics/eleo-ui/issues/1097
[#1098]: https://github.com/ELEOptics/eleo-ui/issues/1098
[#1099]: https://github.com/ELEOptics/eleo-ui/issues/1099
[#1100]: https://github.com/ELEOptics/eleo-ui/issues/1100
[#1101]: https://github.com/ELEOptics/eleo-ui/issues/1101
[#1102]: https://github.com/ELEOptics/eleo-ui/issues/1102
[#1103]: https://github.com/ELEOptics/eleo-ui/issues/1103
[#1104]: https://github.com/ELEOptics/eleo-ui/issues/1104
[#1105]: https://github.com/ELEOptics/eleo-ui/issues/1105
[#1106]: https://github.com/ELEOptics/eleo-ui/issues/1106
[#1107]: https://github.com/ELEOptics/eleo-ui/issues/1107
[#1108]: https://github.com/ELEOptics/eleo-ui/issues/1108
[#1109]: https://github.com/ELEOptics/eleo-ui/issues/1109
[#1110]: https://github.com/ELEOptics/eleo-ui/issues/1110
[#1111]: https://github.com/ELEOptics/eleo-ui/issues/1111
[#1112]: https://github.com/ELEOptics/eleo-ui/issues/1112
[#1113]: https://github.com/ELEOptics/eleo-ui/issues/1113
[#1114]: https://github.com/ELEOptics/eleo-ui/issues/1114
[#1115]: https://github.com/ELEOptics/eleo-ui/issues/1115
[#1116]: https://github.com/ELEOptics/eleo-ui/issues/1116
[#1117]: https://github.com/ELEOptics/eleo-ui/issues/1117
[#1118]: https://github.com/ELEOptics/eleo-ui/issues/1118
[#1119]: https://github.com/ELEOptics/eleo-ui/issues/1119
[#1120]: https://github.com/ELEOptics/eleo-ui/issues/1120
[#1121]: https://github.com/ELEOptics/eleo-ui/issues/1121
