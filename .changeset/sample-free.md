---
"@eleoptics/plots": minor
---

Breaking: `useSample`, `sample`, `ELEO.sample`, the `./sample` export and `eleo-plots-sample.js` are removed, so no renderer reads a built-in sample and the package ships none. Each removed call throws an error that says `see the README migration table`, or is no longer exported: `throughFocus` takes `{ defocus, rows }`, `curve` takes `series` or `panels` (its `kind` and `CurveKindProps` are gone), `spot` takes `panels`, `map2D` takes `{ values, extent }` and no longer takes a canvas, `layout2D` and `glassLegend` take `{ data: RecordedLayout }` (a `LayoutSystem` is rejected), `legend(kind)` returns `""` without `n` or `values`, and a padded glass name (`" N-BK7"`) throws the unknown-glass error. `rayFan` and `RayFanProps` are removed: draw fans with `curve({ panels })`. See "Migration: removed in the sample-free minor" in the README, which has a row for each.
