---
"@eleoptics/plots": minor
---

Curve panels and a typed spot diagram. `curve` takes `panels`, each a `CurvePanel` of `CurvePanelSeries`, laid out in a grid (`columns`, default one row) with shared ranges; a `null` point breaks the line. `rayFan` now draws through curve panels, so its look changes. `spot` takes typed panels (`SpotPanel` of `SpotSeries`) with a `reference`: `'chief'`, labelled with `origin`, or `'centroid'`. `showStats` prints RMS and GEO radii computed about that reference. `showAiry` draws the Airy circle as the panel's `airy`. A caption names each active setting. The sample `spot()` call now draws through the typed path: dots instead of circles, with RMS and GEO computed. New types: `CurvePanel`, `CurvePanelSeries`, `SpotPanel`, `SpotSeries`. `CurvePlotProps` and `SpotDiagramProps` are now unions, so a consumer that `extends` either as an interface writes `type X = CurvePlotProps & { ... }` instead.
