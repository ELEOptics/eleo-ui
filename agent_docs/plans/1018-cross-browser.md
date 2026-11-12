# Plan [#1018]: The gallery tests run in Chromium, Firefox and WebKit

Status: approved 2026-11-12
Branch: `plan/1018-cross-browser` PR: [#1041] Depends on: none Roadmap: `agent_docs/roadmap.md`, row S

## Problem

The gallery tests run in Chromium only, so a bug that only another browser shows reaches the user's demo
first: at plan [#804]'s M1 re-demo the hover drop lines overshot the y axis in Firefox alone (CR [#872]), and no
test could have seen it. phos and eleoptics.com are opened in Firefox and Safari as well, so every later row
(export, the major release) needs the same tests to speak for all three engines.

## Ground truth (2026-11-11, main at 3cb5fda)

| Fact | Where |
| -- | -- |
| One implicit project: no `projects`, so Chromium only. 1440 × 900 viewport, the gallery served by `node gallery/serve.mjs` | `playwright.config.js` |
| The full gate installs and runs Chromium only; `--fast` runs no Playwright | `scripts/check.sh:26-27` |
| CI repeats the gate's steps on `ubuntu-latest` and installs Chromium only | `.github/workflows/ci.yml:21` |
| CI takes about 2.5 to 3 minutes end to end today | `gh run list --workflow CI` |
| Playwright 1.63.0; only Chromium is in this Mac's Playwright cache | `npx playwright --version`, `~/Library/Caches/ms-playwright` |
| 8 spec files, 146 tests in a normal run: `interact` 51, `gallery` 37, `map2d` 26, `svelte` 9, `glass-fills` 3, `zoom-budget` 2, plus opt-in `perf` (`PERF=1`) and `gallery-shots` (`SHOTS=1`) | `tests/*.spec.js` |
| No screenshot snapshots (`toHaveScreenshot` is not used): pixel checks read canvases in the page | `tests/` |
| Chromium-only APIs: a CDP session for the device pixel ratio test; a devtools trace for the zoom budget | `tests/gallery.spec.js:653`, `tests/zoom-budget.spec.js:51` |
| U14's oracle names headless Chromium, so `perf.spec.js` is Chromium's by its approved oracle | `tests/perf.spec.js:2`, roadmap U14 |
| `sample call unchanged` compares PNG data URLs byte for byte against a Chromium recording | `tests/map2d.spec.js`, `tests/fixtures/map2d-baseline.json`, [#424] |
| A single plot draws each series as one `<polyline>` with every point as given; only panels go through `seriesPath`, which breaks the line at a bad point | `packages/plots/src/curve.js:65-66` |
| `interact` reads a polyline through the browser's own parse of `points`, guarded by `isFinite` | `packages/plots/src/interact.js:13-16` |
| No recorded baseline holds a bad point, so a fix that leaves clean series as polylines changes no baseline | `tests/fixtures/renderers-baseline.json` (0 NaN or null) |
| `playwright.config.js`, `scripts/check.sh` and `ci.yml` are outside `SRC_RE`, so the pre-commit hook asks no test of them; no unit test reads them today | `scripts/workflow.env`, `tests/unit/` |
| `scripts/check.sh` and `.github/workflows/` are security triggers: `merge.sh` will not merge this plan, the user reviews it | `workflow.md`, Flow step 4 |

Prior art: Playwright's own `projects` (one per browser, `devices['Desktop Firefox']` and so on) and
per-project `testIgnore`. Nothing to build and no new dependency: Firefox and WebKit builds come from
`npx playwright install`, as Chromium does today.

### First run (2026-11-11, `npx playwright test --browser=<name>`, this Mac, macOS 27.2)

| Browser | Passed | Failed | Time | Note |
| -- | -- | -- | -- | -- |
| Chromium | 146 | 0 | 55 s | today's gate |
| WebKit 26.6 | 136 | 10 | 82 s | below |
| Firefox 155 | 132 | 14 | 76 s | with `CFFIXED_USER_HOME` set to a scratch folder; without it Firefox never launches on macOS 27 (below) |

Firefox's launch: on macOS 27.2, Playwright 1.63.0's Firefox exits with `Could not find profile folder`
before any test runs, from Claude's shell and from the user's own terminal alike (2026-11-12). The install
is complete (`INSTALLATION_COMPLETE`, 290 MB, arm64), so no binary is missing. Other projects report the
same on macOS 27: the bundled Firefox still reads `~/Library/Application Support/Firefox`, which macOS 27
protects from other apps. With `CFFIXED_USER_HOME` pointing at a folder of its own, it launches: verified
here, 3 tests and then the whole suite. Reports disagree on whether Playwright 1.65.0's Firefox 159 fixes
it on 27.2; not tested here. Linux (CI) is not affected.

Firefox's 14 failures: the same 10 as WebKit below (2 Chromium-only APIs, [#424], the 7 hover and select
tests: `select events` picks series 1 for 0 here), plus four of its own:

| Test | Failure | Kind |
| -- | -- | -- |
| `gallery.spec.js:692` curve keys | the MTF key "0° tangential" overlaps "2° sagittal" at 1440 px | to diagnose: text widths differ |
| `gallery.spec.js:759` fan and footprint keys | the footprint key "F1 0.0°" overlaps "F3 24.0°" at `minWidth` | to diagnose: text widths differ |
| `interact.spec.js:1896` + - 0 zoom about the current point | the y zoom factor differs by 3.4e-6, tolerance 1.2e-6 | to diagnose: bug or tolerance |
| `map2d.spec.js:207` recorded PSF cells (U8) | one axis misses the plot area by 1.5 px, limit 0.5 | to diagnose |

Twelve distinct failures that are not a Chromium-only API: 7 shared, [#424], 4 in Firefox alone.

WebKit's 10 failures:

| Test | Failure | Kind |
| -- | -- | -- |
| `gallery.spec.js:633` canvas tiles redraw at their width | `newCDPSession` is Chromium only | Chromium-only spec (O2) |
| `zoom-budget.spec.js:40` a 1000x zoom redraws within budget | `browser.startTracing` is Chromium only | Chromium-only spec (O2) |
| `map2d.spec.js:10` sample call unchanged | the PSF PNG's bytes differ from the Chromium recording | [#424], an oracle change (O4) |
| `interact.spec.js:57` and `:62` hover round trip | no hover event arrives (`undefined.series`) | to diagnose: bug or tolerance |
| `interact.spec.js:80` non-finite points are skipped | hover x off by 0.53 px, `TOL_PX` 0.5 | to diagnose |
| `interact.spec.js:784` layout ray hover reads along a run | segment middle x off by 0.72 px, `TOL_PX` 0.5 | to diagnose |
| `interact.spec.js:798` select events | click selects field 2, expected 0 | to diagnose |
| `interact.spec.js:1831` arrows step points and series | no pointer event to compare with | to diagnose |
| `gallery.spec.js:929` tooltip on every curve tile | the dark MTF tile's tooltip stays empty | to diagnose |

The seven hover and select failures are the same seven in Firefox and WebKit, so they likely share a cause
in how `interact.js` maps the pointer to a mark (`getScreenCTM` against the test's `getBoundingClientRect`:
the misses are 0.5 to 0.7 px). Under the kill criterion's 20.

The drop-line test that CR [#872] added passes in all three browsers.

## Outcomes

What is observably true when this plan is done. Each one has an acceptance test.

Oracle: where the expected values come from, `<kind> <source>` (`agent_docs/agents/workflow.md`, Oracles).

The `gate.test.js` tests do not read the config back: they run `npx playwright test --list --reporter=json`
and assert on what each project resolves.

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 | The gate and CI run the gallery tests in three browser projects: Chromium, Firefox and WebKit | Given the repo after `npm ci && npm run build`, when Playwright lists its tests, then they are listed under exactly the projects chromium, firefox and webkit, and `scripts/check.sh` and `ci.yml` each install all three. The orchestrator checks the PR head's CI run at the demo (no unit test can) | `user roadmap row S (2026-11-10): Chromium, Firefox and WebKit`; `spec Playwright projects (playwright.dev/docs/test-projects)` | `tests/unit/gate.test.js::three browsers` |
| O2 | Specs that rest on Chromium run in the chromium project alone, and no spec conditions a skip on the browser | Given the listing, when the firefox and webkit projects are read, then neither lists a test from `zoom-budget`, `perf`, `gallery-shots`, `pixel-ratio` or `map2d-sample`, chromium lists them all, and no spec file calls `test.skip` or `test.fixme` with `browserName` | `spec Playwright: CDPSession and browser.startTracing are Chromium only (playwright.dev/docs/api/class-cdpsession)`; `measurement roadmap U14: headless Chromium` (perf); `user round 2 (2026-11-12): the PNG recording stays Chromium's`; gallery-shots writes one fixed path per tile, so three projects would overwrite each other | `tests/unit/gate.test.js::chromium-only specs` |
| O3 | Hover, click, keyboard and zoom behave the same in all three browsers | Given the listing, when the firefox and webkit projects are read, then both list every test of `tests/interact.spec.js` and `tooltip on every curve tile`, and the gate that runs them is green | each test's own oracle, unchanged (U13's property: a pointer at a drawn point emits that point); a per-browser tolerance only through a CR the user accepts | `tests/unit/gate.test.js::interact runs everywhere` |
| O4 | Every test that is not Chromium-only passes in all three browsers | Given the listing, when the three projects are compared, then firefox and webkit list exactly what chromium lists minus O2's five files: nothing is pending | `user roadmap row S: green in all three browsers`; each test's own oracle | `tests/unit/gate.test.js::nothing pending` |
| O5 | A single-plot `curve` series with a NaN or infinite point draws its finite runs, in every browser ([#884]) | Given `curve` with one series `[[0,0],[1,1],[NaN,2],[3,1],[4,0]]` and no panels, when it is drawn in the gallery page, then the series is drawn as two runs with a total length above 0, in all three projects | `user issue #884: a bad point breaks the line as it does in panels`; `reference: the panel path for the same points` | `tests/interact.spec.js::single plot bad point` |

## Non-goals

- H's interaction leftovers ([#1004], [#883], [#996], [#855]): row interaction-polish.
- [#1007] (the plots-svelte peer): waits for PR [#676].
- [#424] (PNG bytes against pixels): the test stays Chromium's (user, round 2), so its oracle does not change; back to Deferred, waiting for a Chromium bump that changes the bytes. If this plan's own bump does, item [#1020] stops and asks.
- A null coordinate on a single plot: it still draws as 0 (`tests/unit/curve.test.js::single plot range unchanged by nulls`, an approved oracle). [#884] is about NaN and infinite coordinates only.
- Redraw timings in Firefox and WebKit: U14's approved oracle is headless Chromium.
- Three parallel CI jobs, and a repeat-run flake check: offered in round 2's pre-mortem and not picked. One serial job: about 3.5 minutes of Playwright here, an estimated 7 minutes of CI.
- A manual look at the gallery in Firefox and Safari at each demo: the user chose the test summary and CI (round 1).
- Mobile viewports, branded Chrome, Edge or Safari channels, Windows: nobody asked; the three engines are the ask.
- Screenshot snapshots per browser: the gallery has none today.
- A Linux measurement in Docker before the projects land: a 2 GB image for one run. Item [#1025] reads CI's first run.

## Existing issues

| Issue | Bucket (absorb / supersede / related) | Where or why |
| -- | -- | -- |
| [#884] | absorb | O5, reused as item [#884]: the single plot draws a series holding a NaN or infinite point as a path, as panels do; a clean series stays a polyline, so no baseline changes |
| [#889] | absorb | In item [#884]: the `isFinite` guard in `interact.js` stays, with a comment saying why (an SVG2 point list can hold a NaN set from script). One of the issue's own two options; no browser run needed |
| [#983] | absorb | One sentence of `packages/plots/README.md:44`, in item [#884], which edits that README. It is a `layout2D` line and traces to no outcome: it rides along because the file is open |
| [#424] | related | Non-goals: the test stays Chromium-only |
| [#1007] | related | Waits for PR [#676] (Version Packages) to merge |
| [#1004], [#883], [#996], [#855] | related | Row interaction-polish |
| [#850], [#997] | related | Deferred: their performance triggers have not fired |

## Constraints and assumptions

- **Tolerances stay tight** (user, round 2 pre-mortem). A failing test is fixed in the code first. A tolerance is
  loosened only when the diagnosis shows the browser itself rounds differently, only for that browser, and only
  through a CR the user accepts, with the measured numbers. No item loosens one on its own.
- **The gate stays green at every commit.** Firefox and WebKit join the config in M1 with a pending list: the
  titles of the tests known to fail there, left out by `grepInvert`. Each fix removes its titles in the same
  commit, and M4 deletes the list. The list is not a skip marker in a spec, and O4's test fails while it exists.
- **Green means this Mac and CI.** macOS and CI's Linux differ in WebKit and in fonts. The failure list is
  measured on the Mac; item [#1025] adds what only Linux fails, from CI's first three-browser run, which may be red
  once on the draft PR. A title leaves the pending list only when it passes in both.
- **The failure list is a measurement on Playwright 1.63.0** (Ground truth, First run). The user chose to bump to
  1.65.0 and to re-measure as M1's first step, not before approval. A test that fails on 1.65.0 and is not in
  this plan becomes a CR; more than 20 real failures fires the roadmap's kill criterion for row S.
- Assumption: Playwright 1.65.0's Firefox launches on macOS 27.2. Reports disagree. If it does not, item [#1024] sets
  `CFFIXED_USER_HOME` for the firefox project on macOS, which is verified to work on 1.63.0.
- `--browser` on the command line replaces the config's projects, so it drops the ignore and pending lists.
  After item [#1024], run one browser with `--project=firefox`.
- This plan touches `scripts/check.sh`, `.github/workflows/ci.yml` and `package-lock.json`: security triggers, so
  `merge.sh` will not merge it and the user reviews the PR.

## Decisions

No ADR: Playwright's projects are the tool's own mechanism, and there was no second design.

Core changes, approved with the plan:

- `packages/plots/src/index.d.ts`: one sentence on `CurveSeries.points`' comment (line 259), saying that a NaN
  or infinite coordinate breaks the line (item [#884]). A comment only; no type changes.

`CLAUDE.md` does not change: its Setup and Tests commands stay true and are re-verified at plan end. The
browser install lives in `scripts/check.sh` and `README.md`, as Chromium's does today.

Changesets: one patch changeset for `@eleoptics/plots`, `.changeset/cross-browser.md`, created by item [#884] and
extended by each later item that changes `packages/plots/src`.

## Milestones

### M1: Three browsers in the gate GitHub: `P1018 M1: Three browsers in the gate`

Done 2026-11-12: review round 4 (Review M1: 0 blocking, nothing pulled in); full gate green on 3c86004 (412 passed: chromium 147, firefox 129, webkit 136; 14 pending in Firefox, 7 in WebKit); CI green on c7b3d69, pending on 3c86004 at the tick. Demo: go (user, 2026-11-12).

Demo: `npx playwright test` prints passes under chromium, firefox and webkit and 0 failed, with the number of
pending titles per browser beside it; `npx playwright test --list` shows the Chromium-only specs under chromium
alone; the PR head's CI run is green with all three installed. Proves: O1, O2

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1019] | O1 and O2 acceptance tests, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/gate.test.js` (new) | `tests/unit/gate.test.js::three browsers`, `::chromium-only specs` |  |
| [#1020] | Playwright 1.65.0, and the failure list measured again: bump `@playwright/test`, install its three browsers, run the Chromium gate, then `npx playwright test --browser=firefox` and `--browser=webkit`, and post the failure table on this issue beside the 1.63.0 one. If Firefox does not launch on macOS 27.2, say so and run it again with `CFFIXED_USER_HOME` set, so the table is still measured. Stop and return a CR if a Chromium test fails after the bump (`sample call unchanged` is [#424]'s trigger), if a test fails that this plan does not list, or if more than 20 real failures remain (the kill criterion) | forced (user, round 2: bump to 1.65.0; round 3: re-measure as M1's first item) (user) | `package.json` (`"@playwright/test": "^1.65.0"`), `package-lock.json` | `tests/unit/gate.test.js::playwright version` (the lock resolves `@playwright/test` at 1.65.0 or later) | [#1019] |
| [#1021] | The pixel-ratio check gets its own spec: the part of `canvas tiles redraw at their width (#632)` that opens a CDP session (`gallery.spec.js:653-656` and the assertions on it) moves to `tests/pixel-ratio.spec.js`; the width redraw and the airy symmetry check stay in `gallery.spec.js`, so they run in all three browsers. No assertion changes | split the test because only four lines need CDP and the rest is the canvas behaviour worth checking in Firefox and WebKit; considered moving the whole test, which loses that coverage | `tests/pixel-ratio.spec.js` (new), `tests/gallery.spec.js` | both halves pass in Chromium; the listing gains one test | [#1020] |
| [#1022] | `sample call unchanged` moves to `tests/map2d-sample.spec.js` with the `fixture` helper it uses and its oracle line. No assertion changes | one file for a Chromium-only test because `testIgnore` works on files and needs no marker in the spec; considered `grepInvert` on its title, which keeps a title list in the config for good | `tests/map2d-sample.spec.js` (new), `tests/map2d.spec.js` | the moved test passes in Chromium; the listing counts the same tests | [#1021] |
| [#1023] | The gate and CI install all three browsers: `npx playwright install chromium firefox webkit` in `scripts/check.sh`, `--with-deps chromium firefox webkit` in `ci.yml`. `README.md` says the gallery check runs in three browsers, names the install line, and says to run one browser with `npx playwright test --project=firefox`, not `--browser` | install before the projects exist because a push between this item and [#1024] then stays green in CI; considered one item for both, which is four files | `scripts/check.sh`, `.github/workflows/ci.yml`, `README.md` (lines 54 and 58) | `tests/unit/gate.test.js::installs` (both files name the three browsers) | [#1022] |
| [#1024] | Three projects in `playwright.config.js`: chromium, firefox and webkit, each `{ name, use: { browserName } }`; firefox and webkit take `testIgnore: CHROMIUM_ONLY` (the five specs of O2) and a `grepInvert` built from `PENDING`, the titles [#1020]'s table lists per browser, each escaped and anchored to the title's end (titles hold `+`, `(` and `#`). Firefox's list also holds `standalone label style (#112)` and `a lens hover follows the pointer`, and not `arrows step points and series with the pointer's events` (WebKit only on 1.65.0); no `CFFIXED_USER_HOME`: Firefox launches on 1.65.0 (CR [#1042]) | `browserName` alone because `devices['Desktop Firefox']` replaces the 1440 × 900 viewport the tests' widths rest on; considered the device presets. A pending list in the config because the gate must be green at every commit and each fix must show in the gate when it lands; considered fixing everything through `--browser` first and adding the projects last, which leaves CI's Linux unseen until the end | `playwright.config.js`, `tests/unit/gate.test.js` | `tests/unit/gate.test.js::projects` (the listing has the three projects; every `PENDING` title matches exactly one listed test) | [#1023] |
| [#1025] | Linux's failures join the pending list: read the CI run of [#1024]'s push; a test that fails only there gets its title in `PENDING` and a comment on this issue with the failure. A failure this plan does not list is also a CR, as in [#1020]. If CI is green, the item closes with the run's link | read CI's first run because it is the Linux measurement and costs nothing; considered Playwright's Docker image on this Mac, a 2 GB download for one run | `playwright.config.js` | the CI run of this item's push is green | [#1024] |
| [#1047] | The specs wait for each wheel's redraw before they read the frame (a shared helper per spec file: poll the frame or wait for the wheel's `view` event); `layout zoom pan and reset` leaves Firefox's `PENDING`. No assertion, tolerance or oracle changes (CR [#1046]) | wait in the test because the renderer redraws on its own schedule and the oracle is the frame after the wheel; considered `retries` in CI, which hides the race, and a `PENDING` title per failure, which leaves the next one to fail | `tests/interact.spec.js` and any spec that reads a frame straight after `mouse.wheel`, `playwright.config.js` (title removed) | `zoom pan and reset` and `layout zoom pan and reset` under load in all three projects; the CI run of this item's push is green | [#1025] |
| [#1026] | Unskip O1 and O2 acceptance tests | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/gate.test.js` | `::three browsers`, `::chromium-only specs` | all above |
| [#1049] | One test listing in `gate.test.js`: `listing()` returns `project -> [{ file, name }]` and all three listing tests use it; no assertion changes (CR [#1048], review M1 round 1) | one listing because `projects`' Chromium-only filter drops the only files `PERF`/`SHOTS` add; considered two calls, a spawn and 15 lines for nothing | `tests/unit/gate.test.js` | `node --test tests/unit/gate.test.js`: the same 5 pass, one `execFileSync` | [#1026] |
| [#1050] | O2's skip check fails on any spec that mentions `browserName` and calls `.skip(`, `.fixme(` or `.fail(` (review M1 round 1, backlog) | match on the file because a skip can take a condition computed earlier; considered a wider call regex, which still misses a variable | `tests/unit/gate.test.js` | `::chromium-only specs` red on a scratch `test.skip(ff)` spec, green on the repo | [#1049] |
| [#1051] | The negative wheel check in `zoom pan and reset` waits two animation frames before counting view events (review M1 round 1, backlog) | wait frames because the `wheel` helper waits for an event that must not come here; considered a second handled input | `tests/interact.spec.js` | `zoom pan and reset` in all three projects | [#1050] |
| [#1052] | `pixel-ratio.spec.js` expects 4 canvas tiles before the CDP override, as its source test did (review M1 round 1, backlog) | copy the count from the original test; considered a non-empty check, which accepts a missing tile | `tests/pixel-ratio.spec.js` | `canvas tiles redraw at the device pixel ratio (#638)` in chromium | [#1051] |
| [#1053] | O2's skip check also fails a spec that names `project.name` or `projectName` with a skip, fixme or fail (review M1 round 2, backlog) | widen the pattern because the project name is the browser here; considered a list of browser names, which matches any string | `tests/unit/gate.test.js` | `::chromium-only specs` red on a scratch `test.skip(info.project.name === 'webkit')` spec, green on the repo | [#1052] |
| [#1054] | `gate.test.js` runs `playwright test --list` once per unit run and reuses it in its three tests (review M1 round 2, backlog) | cache because CR [#1048]'s cost was the spawn; considered a `before` hook, the same state with more ceremony | `tests/unit/gate.test.js` | the same 5 pass; the three listing tests take about one listing's time | [#1053] |
| [#1055] | O2's skip check also matches `project?.name` (review M1 round 3, backlog) | one optional `?` because it is the other spelling of the same access; considered any `name` near `project`, which flags unrelated code | `tests/unit/gate.test.js` | `::chromium-only specs` red on a scratch `project?.name` skip, green on the repo | [#1054] |

### M2: A bad point breaks the line on a single plot GitHub: `P1018 M2: A bad point breaks the line on a single plot`

Done 2026-11-12: review round 2 (Review M2: 0 blocking, nothing pulled in); full gate green on ba75546 (415 passed in three projects); CI green on dfebc86, pending on ba75546 at the tick. Demo: go (user, 2026-11-12).

Demo: in the gallery page, `ELEO.curve` with one series holding a NaN point draws both finite runs, under all
three projects; in Chromium it also hovers on each run; `npx playwright test` and CI are green. Proves: O5

This milestone comes before the hover fixes because `non-finite points are skipped` asserts Chromium's parse of
a NaN polyline, which item [#884] replaces; M3 then makes that test pass in Firefox and WebKit.

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1027] | O5 acceptance test, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/interact.spec.js` | `tests/interact.spec.js::single plot bad point` |  |
| [#884] reuse | A single plot draws a series that holds a NaN or infinite coordinate as a `<path>` whose runs break at the bad point: unzoomed through `seriesPath`, zoomed through the panel branch (its runs and `cutPieces`). A null still draws as 0, and a series with no bad point stays a `<polyline>`, so `renderers-baseline.json` does not change. Three tests that pin today's behaviour are rewritten to the new one: `non-finite points are skipped`' second half (`interact.spec.js:118-121`: the series now hovers on its finite runs), `a zoomed series with a NaN draws as the unzoomed one` (`curve.test.js:1057`), and any range assertion that counted the bad point. `interact.js`'s polyline `isFinite` guard stays and gains a comment ([#889]). `index.d.ts`' comment and the README's `curve` and hover paragraphs say a NaN or infinite coordinate breaks the line; the README's mirror line ([#983]) reads "Obscurations sit under the rays, with the glass polygons; mirror bodies are drawn over them." Creates the changeset. Stop and return a CR if a recorded baseline changes, or if `single plot range unchanged by nulls` would have to change (approved oracles) | a path only for a series with a bad point because every clean series, which is every recorded one, keeps its markup and its baseline; considered a path for every single-plot series, which re-records the baseline and rewrites the tests' `polyline` selectors (52 mentions) | `packages/plots/src/curve.js`, `packages/plots/src/interact.js` (comment), `packages/plots/src/index.d.ts` (comment), `packages/plots/README.md`, `.changeset/cross-browser.md`, `tests/unit/curve.test.js`, `tests/interact.spec.js` | `tests/unit/curve.test.js::non-finite points break a single-plot series` (the same runs as the panel path for the same points) | [#1027] |
| [#1028] | Unskip O5 acceptance test. It joins `PENDING` for a browser only if it fails there for a reason M3 lists | forced (`workflow.md`, TDD: the last item unskips them) | `tests/interact.spec.js` | `::single plot bad point` | all above |
| [#1056] | `cutPieces`' header comment names a single plot's bad-point series as path runs (review M2 round 1, backlog) | reword the comment because the code path is right and only the comment is incomplete, and assert its claim because the pre-commit hook needs a test with any source change; considered leaving it, which misleads the next reader of the cut | `packages/plots/src/curve.js` (comment), `tests/unit/curve.test.js` | `curve.test.js::a zoomed series with a NaN draws as the panel one` (no mark spans the bad point) | [#1028] |

### M3: Hover, click and keyboard in Firefox and WebKit GitHub: `P1018 M3: Hover, click and keyboard in Firefox and WebKit`

Demo: `npx playwright test tests/interact.spec.js` and `-g "tooltip on every curve tile"` pass under all three
projects; the pending list holds no interaction test; CI is green. Proves: O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1029] | O3 acceptance test, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/gate.test.js` | `tests/unit/gate.test.js::interact runs everywhere` |  |
| [#1030] | Spike, 2 hours: why the seven tests that fail in both Firefox and WebKit fail, and Firefox's `a lens hover follows the pointer` (CR [#1042]) and, on Linux, `layout zoom pan and reset` (CR [#1044]). For each, a comment on this issue with the cause, the line, and whether it is the code (`interact.js`), the test's own geometry (`drawnAt` reads `getBoundingClientRect`, `interact` reads `getScreenCTM`) or the browser's rounding, and which tests share a cause. No production code | a spike because items [#1031] to [#1033] are cut by test and the cause decides whether they are one fix or three; considered folding the diagnosis into [#1031], which hides a shared cause from [#1032] and [#1033] | none (issue comment) | none (spike: `workflow.md`, Work items) | [#1029] |
| [#1031] | Hover reaches the point under the pointer in Firefox and WebKit: a spec helper puts each computed pointer on the pixel the browser delivers (Firefox and WebKit truncate it, [#1030]), and the hover tests aim with it: `hover emits the point under the pointer`, `curve hover round trip`, `arrows step points and series with the pointer's events` (WebKit only on 1.65.0), `tooltip on every curve tile`, and, in Firefox, `a lens hover follows the pointer` (CR [#1042]) and `layout zoom pan and reset` (CR [#1044], Linux) leave `PENDING`. `TOL_PX`, `REACH` and `inFrameOf`'s 0.5 px slack do not change | round in the specs because the browsers deliver whole pixels and `interact.js` reads them correctly ([#1030]; user, 2026-11-12); considered widening `inFrameOf`'s slack to 1 px, which loosens what in frame means in every browser | `tests/interact.spec.js`, `tests/gallery.spec.js`, `playwright.config.js` (titles removed) | the named tests under `--project=firefox` and `--project=webkit`; the CI run of this item's push is green | [#1030] |
| [#1032] | Hover reads within `TOL_PX` in Firefox and WebKit: `non-finite points are skipped` (0.53 px today) and `layout ray hover reads along a run` (0.72 px) place the pointer with [#1031]'s helper and compute the expected reading at the delivered pixel; both leave `PENDING`. `TOL_PX` does not change | read the oracle at the pixel the browser sent because the miss is the browser's truncation, not the mapping ([#1030]; user, 2026-11-12); considered a CR to loosen `TOL_PX` for those browsers, which the user did not pick | `tests/interact.spec.js`, `playwright.config.js` (titles removed) | the two named tests under both projects | [#1031] |
| [#1033] | A click selects the mark under the pointer in Firefox and WebKit: `select events` probes `elementFromPoint` at the pixel the click is delivered to ([#1031]'s helper), and leaves `PENDING` (today it reports field 2 for 0 in WebKit and series 1 for 0 in Firefox, because the probe and the click hit different pixels) | probe where the click lands because `interact.js`' `click` names the mark the browser hit ([#1030]; user, 2026-11-12); considered clicking a different point, which hides a wrong pick if there were one | `tests/interact.spec.js`, `playwright.config.js` (title removed) | `select events` under both projects | [#1032] |
| [#1058] | `interact.js` reads a data group's matrix without `transform.baseVal.consolidate()` (`windowOf`, `showMarks`), so a hover or click leaves the `transform` attribute byte-identical in every browser; `select events` leaves Firefox's `PENDING` (CR [#1057]) | read the one matrix item without mutating the list because `consolidate()` replaces the list by spec and Firefox re-serializes it with shortened numbers; considered normalising `matrix(...)` in the test, which loosens `markup unchanged` | `packages/plots/src/interact.js`, `playwright.config.js` (title removed), `.changeset/cross-browser.md`, `tests/interact.spec.js` | `interact.spec.js`: a hover leaves the `transform` attribute unchanged; `select events` under `--project=firefox` | [#1033] |
| [#1034] | The keyboard zoom factor is the same on x and y in Firefox: `+ - 0 zoom about the current point and reset` leaves `PENDING` (3.4e-6 off against 1.2e-6). Stop and return a CR with the numbers if the difference is Firefox's own layout arithmetic | fix the factor's arithmetic first, forced (Constraints: tolerances stay tight) | `packages/plots/src/interact.js`, `playwright.config.js` (title removed) | the named test under `--project=firefox` | [#1058] |
| [#1035] | Unskip O3 acceptance test | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/gate.test.js` | `::interact runs everywhere` | all above |

### M4: Keys and maps in Firefox, nothing pending GitHub: `P1018 M4: Keys and maps in Firefox, nothing pending`

Demo: `npx playwright test` is green under all three projects with no pending list in the config; CI is green.
Proves: O4

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#1036] | O4 acceptance test, skipped | forced (`workflow.md`, TDD: the first item writes them skipped) | `tests/unit/gate.test.js` | `tests/unit/gate.test.js::nothing pending` |  |
| [#1037] | Key entries do not overlap in Firefox: `curve keys` (the MTF key at 1440 px) and `fan and footprint keys` (the footprint key at `minWidth`) leave `PENDING`. `key.js:17` places entries by 0.6 × the text size per character; find what Firefox draws wider (the font it falls back to, or its advance) and fix that. Stop and return a CR if the fix moves a key in Chromium: the tiles' look is the user's (roadmap, kill criterion D on) | fix the width the placement assumes because the overlap test's oracle (no two texts overlap) is browser-neutral; considered measuring text in the page, which `key.js` cannot do (it returns markup, ADR-0001) | `packages/plots/src/key.js`, `playwright.config.js` (titles removed), `.changeset/cross-browser.md` | the two named tests under `--project=firefox`; `tests/unit/key.test.js` for the changed width | [#1036] |
| [#1038] | The recorded PSF's axes fill the plot area in Firefox: `recorded PSF cells (U8)` leaves `PENDING` (one axis is 1.5 px off against 0.5). Stop and return a CR with the numbers if it is Firefox's image rounding | fix the image's placement because U8's oracle (each sampled pixel matches its value) does not change; considered a Firefox tolerance, which Constraints forbid without a CR | `packages/plots/src/map2d.js`, `playwright.config.js` (title removed) | the named test under `--project=firefox` | [#1037] |
| [#1043] | The standalone label's font size matches `layoutText(1000)` in Firefox: `standalone label style (#112)` leaves `PENDING` (13.6333 for 13.62770 on 1.65.0, 0.0056 against 0.005). Find whether Firefox quantises the computed size or our code computes another value; fix it in code if it is ours. Stop and return a CR with the numbers if it is Firefox's own rounding (CR [#1042]) | diagnose before any tolerance, forced (Constraints: tolerances stay tight; CR [#1042]); considered loosening the precision now, which the user did not pick | `packages/plots/src/layout2D.js` (or the module the diagnosis names), `playwright.config.js` (title removed), `.changeset/cross-browser.md` | the named test under `--project=firefox` | [#1038] |
| [#1039] | The pending list is gone: `PENDING` and `grepInvert` leave `playwright.config.js`; firefox and webkit differ from chromium only by `CHROMIUM_ONLY`. `scripts/check.sh`'s header says the gate runs three browsers | delete the list, not empty it, because O4's test then cannot pass with a leftover title; considered keeping an empty list for later failures, which invites the next one in | `playwright.config.js`, `scripts/check.sh` (header) | `tests/unit/gate.test.js::projects` (no pending title left) | [#1043] |
| [#1040] | Unskip O4 acceptance test | forced (`workflow.md`, TDD: the last item unskips them) | `tests/unit/gate.test.js` | `::nothing pending` | all above |

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| Playwright 1.65.0 changes the failure list measured on 1.63.0 | Items name tests that now pass, or miss ones that now fail | Item [#1020] re-measures first; differences are CRs; the kill criterion (20) is checked there |
| The bump's new Chromium changes the PSF PNG's bytes | `sample call unchanged` fails in Chromium: [#424]'s trigger, an oracle question | Item [#1020] stops and returns a CR; the user decides |
| Firefox 159 still does not launch on macOS 27.2 | The gate cannot run Firefox here | Item [#1024] sets `CFFIXED_USER_HOME` on darwin, verified on 1.63.0 |
| Linux fails tests the Mac passes | CI's first three-browser run is red | Item [#1025] reads that run and adds the titles; one red run on the draft PR is accepted |
| The seven shared failures have one cause, or seven | M3 is one item, or more than four | Spike [#1030] before any fix; the orchestrator folds or splits [#1031] to [#1033] by its finding |
| A failure is the browser's own rounding | A fix in the code is impossible | The item stops with a CR carrying the measured numbers; the user accepts a per-browser tolerance or not |
| Three browsers triple the Playwright time | The full gate takes about 3.5 minutes of Playwright, CI an estimated 7 | Accepted (round 2); a CI matrix is a non-goal |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-11-11: draft written from the roadmap row and the repo; round 1 open.
- 2026-11-11 round 1 (user): issue buckets as proposed (absorb [#884], [#889], [#983], and [#424] if the first run fails it; [#1007] and the interaction-polish issues related).
- 2026-11-11 round 1 (user): run the first three-browser run now, before the milestones are drafted.
- 2026-11-11 round 1 (user): each demo is the gate's three-project summary and the green CI run; no manual look in Firefox and Safari.
- 2026-11-11 first run: Chromium 146 passed; WebKit 136 passed, 10 failed (2 Chromium-only APIs, [#424]'s PNG bytes, 7 hover and select); Firefox does not launch from Claude's command sandbox (`Could not find profile folder`), so its count waits for a run from the user's terminal.
- 2026-11-12 (user): the same Firefox run fails the same way from the user's terminal, so the sandbox is not the cause.
- 2026-11-12 first run, Firefox: with `CFFIXED_USER_HOME` set it launches; 132 passed, 14 failed (the 10 WebKit also fails, plus two key overlaps, a zoom-factor tolerance and a PSF axis). Twelve distinct real failures across both browsers: the kill criterion (20) does not fire.
- 2026-11-12 round 2 (user): Firefox on macOS 27 is fixed by bumping Playwright to 1.65.0, not by the env var; the env var is the fallback if the bump does not launch it.
- 2026-11-12 round 2 (user): `sample call unchanged` stays a Chromium-only test; [#424] moves from absorb to related and its oracle does not change.
- 2026-11-12 round 2 (user), pre-mortem: "tolerances got too loose" is the one failure to guard against; a slow gate, flaky tests and a Mac and CI split were not picked.
- 2026-11-12 round 3 (user): the re-measurement on 1.65.0 is M1's first item, not a run before approval.
- 2026-11-12: critique (general-purpose, claude-opus-5-5; the draft was written on Fable, so the critic ran on Opus). 11 findings.
  - 1: accepted. O2 no longer forbids every `test.skip` (O5's acceptance test is written skipped); it forbids a skip conditioned on the browser.
  - 2: accepted. [#884] covers NaN and infinite coordinates, not null; the three tests that pin today's behaviour are named in item [#884]; the zoomed path goes through the panel branch; O5's oracle no longer cites the panel type's comment.
  - 3: accepted. The bad-point milestone moved ahead of the hover fixes (M2), and its acceptance test checks the drawing only.
  - 4: accepted in part. Item [#1020] re-runs Firefox with the env var if it does not launch; Linux is measured from CI's first run (item [#1025]), not in Docker (a 2 GB image for one run).
  - 5: accepted. Only the CDP part of the pixel-ratio test moves; the rest stays in all three browsers.
  - 6: accepted. `gate.test.js` asserts on `npx playwright test --list`, not on the config; CI's green run is the orchestrator's check.
  - 7: accepted. The README says `--project`, since `--browser` replaces the projects.
  - 8: accepted. The `isFinite` guard stays with a comment; the separate item for [#889] is cut.
  - 9: accepted. Pending titles are escaped and anchored.
  - 10: accepted in part. [#983] is named as riding along. `CLAUDE.md` does not change: its commands stay true, and the install line lives where Chromium's does.
  - 11: accepted in part. The spec moves are two items, M1's demo shows the pending count, the test count is 146. Item [#884] keeps its docs: `workflow.md` puts a behaviour's doc in the same commit.
- 2026-11-12 (user): approved, with the acceptance tests' oracles and the Core change. Published as plan [#1018]: 4 milestones, 23 work items ([#884] reused).
- 2026-11-12 CR [#1042] (user): accepted. On Playwright 1.65.0 Firefox launches with no `CFFIXED_USER_HOME` and fails two tests the plan did not list: `a lens hover follows the pointer` joins spike [#1030] and item [#1031]; `standalone label style (#112)` gets item [#1043] in M4. `arrows step points and series` fails only in WebKit now. [#1024] drops the env fallback.
- 2026-11-12 CR [#1044] (user): accepted. CI's first three-browser run fails two tests in Firefox on Linux only: `arrows step points and series` (listed already) and `layout zoom pan and reset` (not listed). Both join Firefox's `PENDING` in [#1025]; the second joins spike [#1030] and item [#1031].
- 2026-11-12 CR [#1046] (user): accepted. CI on `b1f2819` failed `zoom pan and reset` in Firefox on Linux: the test read the frame before the wheel's redraw (span ratio 1.162, one notch), as `layout zoom pan and reset` did. Item [#1047] makes the specs wait for the redraw; that title leaves Firefox's `PENDING`, and CR [#1044]'s additions to [#1030] and [#1031] are undone.
- 2026-11-12 (user): CI on `e5cda16` ([run 43273034181](https://github.com/ELEOptics/eleo-ui/actions/runs/43273034181)) passes `zoom pan and reset` but fails `layout zoom pan and reset` again in Firefox on Linux, at the browser's hit test with the redraw awaited: not the wheel race. It goes back to Firefox's `PENDING`, spike [#1030] and item [#1031], as CR [#1044] first had it; [#1047] is done.
- 2026-11-12 Review M1 round 1 (code-reviewer, claude-opus-5-5): 1 blocking, 3 backlog. CR [#1048] (accepted by the orchestrator: no invariant, test code only) becomes item [#1049]. 
- 2026-11-12: backlog [#1050], [#1051] and [#1052] into M1 (orchestrator: small, named fixes in files this milestone changed).
- 2026-11-12 Review M1 round 2: 0 blocking, 2 backlog; carried CRs [#1042], [#1044], [#1046], [#1048] resolved. Backlog [#1053] and [#1054] into M1 (orchestrator: small, named, in `gate.test.js`); round 3 follows.
- 2026-11-12 Review M1 round 3: 0 blocking, 1 backlog; backlog [#1055] into M1 (orchestrator: a one-character fix in `gate.test.js`); round 4 follows.
- 2026-11-12 Review M1 round 4 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. Per-round count (blocking + pulled in): 4, 2, 1, 0. M1 ticked; demo pending.
- 2026-11-12 (user): M1 demo go; M2 starts. The user skipped the start gate (`scripts/check.sh` was green on 3c86004 at the tick).
- 2026-11-12 Review M2 round 1 (code-reviewer, claude-opus-5-5): 0 blocking, 1 backlog. Backlog [#1056] into M2 (orchestrator: a one-comment fix in `curve.js`, which M2 changed); round 2 follows.
- 2026-11-12 re-scope (orchestrator): [#1056] also asserts its comment's claim in `curve.test.js`, since `check-tests-touched.sh` refuses a comment-only source change.
- 2026-11-12 Review M2 round 2 (code-reviewer, claude-opus-5-5): 0 blocking, nothing pulled in. Per-round count (blocking + pulled in): 1, 0. M2 ticked; demo pending.
- 2026-11-12 (user): M2 demo go; M3 starts.
- 2026-11-12 spike [#1030] ([comment](https://github.com/ELEOptics/eleo-ui/issues/1030#issuecomment-6836153812)): one cause. Firefox and WebKit deliver the pointer as whole pixels (truncated), the tests aim at fractional points; `interact.js` reads what it receives correctly.
- 2026-11-12 (user): round in the specs. A helper puts each computed pointer on the delivered pixel and probes and reads the oracle there; `TOL_PX`, `REACH` and `inFrameOf`'s slack stay, `interact.js` does not change. [#1031] to [#1033] become spec fixes (`gallery.spec.js` joins [#1031]'s Files); no changeset from M3. `a lens hover follows the pointer` moves from cause C to [#1031], as the plan had it.
- 2026-11-12 CR [#1057] (orchestrator): accepted. Once [#1033] clicked the right mark, `select events` failed `markup unchanged` in Firefox: `interact.js`' `consolidate()` rewrites the `transform` attribute there with shortened numbers. Item [#1058] fixes it in code; the worker's 5-digit normalisation in the test was not committed (Constraints: tolerances stay tight). [#1033] landed the probe fix and leaves `select events` in Firefox's `PENDING` until [#1058].

[#1004]: https://github.com/ELEOptics/eleo-ui/issues/1004
[#1007]: https://github.com/ELEOptics/eleo-ui/issues/1007
[#1018]: https://github.com/ELEOptics/eleo-ui/issues/1018
[#1019]: https://github.com/ELEOptics/eleo-ui/issues/1019
[#1020]: https://github.com/ELEOptics/eleo-ui/issues/1020
[#1021]: https://github.com/ELEOptics/eleo-ui/issues/1021
[#1022]: https://github.com/ELEOptics/eleo-ui/issues/1022
[#1023]: https://github.com/ELEOptics/eleo-ui/issues/1023
[#1024]: https://github.com/ELEOptics/eleo-ui/issues/1024
[#1025]: https://github.com/ELEOptics/eleo-ui/issues/1025
[#1026]: https://github.com/ELEOptics/eleo-ui/issues/1026
[#1027]: https://github.com/ELEOptics/eleo-ui/issues/1027
[#1028]: https://github.com/ELEOptics/eleo-ui/issues/1028
[#1029]: https://github.com/ELEOptics/eleo-ui/issues/1029
[#1030]: https://github.com/ELEOptics/eleo-ui/issues/1030
[#1031]: https://github.com/ELEOptics/eleo-ui/issues/1031
[#1032]: https://github.com/ELEOptics/eleo-ui/issues/1032
[#1033]: https://github.com/ELEOptics/eleo-ui/issues/1033
[#1034]: https://github.com/ELEOptics/eleo-ui/issues/1034
[#1035]: https://github.com/ELEOptics/eleo-ui/issues/1035
[#1036]: https://github.com/ELEOptics/eleo-ui/issues/1036
[#1037]: https://github.com/ELEOptics/eleo-ui/issues/1037
[#1038]: https://github.com/ELEOptics/eleo-ui/issues/1038
[#1039]: https://github.com/ELEOptics/eleo-ui/issues/1039
[#1040]: https://github.com/ELEOptics/eleo-ui/issues/1040
[#1041]: https://github.com/ELEOptics/eleo-ui/issues/1041
[#1042]: https://github.com/ELEOptics/eleo-ui/issues/1042
[#1043]: https://github.com/ELEOptics/eleo-ui/issues/1043
[#1044]: https://github.com/ELEOptics/eleo-ui/issues/1044
[#1046]: https://github.com/ELEOptics/eleo-ui/issues/1046
[#1047]: https://github.com/ELEOptics/eleo-ui/issues/1047
[#1048]: https://github.com/ELEOptics/eleo-ui/issues/1048
[#1049]: https://github.com/ELEOptics/eleo-ui/issues/1049
[#1050]: https://github.com/ELEOptics/eleo-ui/issues/1050
[#1051]: https://github.com/ELEOptics/eleo-ui/issues/1051
[#1052]: https://github.com/ELEOptics/eleo-ui/issues/1052
[#1053]: https://github.com/ELEOptics/eleo-ui/issues/1053
[#1054]: https://github.com/ELEOptics/eleo-ui/issues/1054
[#1055]: https://github.com/ELEOptics/eleo-ui/issues/1055
[#1056]: https://github.com/ELEOptics/eleo-ui/issues/1056
[#1057]: https://github.com/ELEOptics/eleo-ui/issues/1057
[#1058]: https://github.com/ELEOptics/eleo-ui/issues/1058
[#424]: https://github.com/ELEOptics/eleo-ui/issues/424
[#676]: https://github.com/ELEOptics/eleo-ui/issues/676
[#804]: https://github.com/ELEOptics/eleo-ui/issues/804
[#850]: https://github.com/ELEOptics/eleo-ui/issues/850
[#855]: https://github.com/ELEOptics/eleo-ui/issues/855
[#872]: https://github.com/ELEOptics/eleo-ui/issues/872
[#883]: https://github.com/ELEOptics/eleo-ui/issues/883
[#884]: https://github.com/ELEOptics/eleo-ui/issues/884
[#889]: https://github.com/ELEOptics/eleo-ui/issues/889
[#983]: https://github.com/ELEOptics/eleo-ui/issues/983
[#996]: https://github.com/ELEOptics/eleo-ui/issues/996
[#997]: https://github.com/ELEOptics/eleo-ui/issues/997
