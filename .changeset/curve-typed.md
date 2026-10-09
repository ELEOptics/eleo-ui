---
"@eleoptics/plots": minor
---

A typed curve: `curve({ series, x, y })` draws any series, each with a role (`tangential`, `sagittal`, `reference`, `index`), 1 px strokes, nice default axes, and a viewport clip. `kind` works as before; its tick labels print at one shared precision. New in physics: `mtfDiffraction`. `legend` draws without the sample. `CurvePlotProps` is now a union type, so a consumer that `extends` it as an interface writes `type X = CurvePlotProps & { ... }` instead.
