# phos-core recordings

Raw results of phos-core's Python client for public lenses, recorded by `scripts/record-phos-core.py` (its
header says how to build the client with `clients/python/dev.sh`). Each file carries the phos-core commit sha and
the script's arguments. They are committed; the gate does not re-record them. Numbers are rounded to 6 significant
digits.

- `achromat-*`: the sample achromat (`packages/plots/src/sample.json`: N-BK7/SF5, R 62.8/-45.7/-128.2 mm, EPD 25 mm,
  fields 0/1/2 deg in `achromat-mtf.json`, 486.1/587.6/656.3 nm), built as a `LensTable`. Its efl is within 0.1% of `sample.efl` (the
  recording's own check, and `tests/unit/phos-core-fixtures.test.js`). Its back focal distance (97.22 mm) is not
  the sample's 97.126: the sample's image plane is the best on-axis RMS focus.
- `cooke-*`: `OpticalModel.cooke_triplet_kingslake()`, fields 0/17/24 deg in `cooke-mtf.json`, 450/550/650 nm.
- `wandersleb*`: the air-spaced triplet of US 1,073,789 (E. Wandersleb, Carl Zeiss, 1913, expired), Example 2, from phos's
  `fixtures/triplet.toml`, copied unchanged with its source comment to `wandersleb.toml` (so the recorder and the tests share
  one transcription of the patent). Constant-index glasses at 587.6 nm, EPD 15.87 mm, fields 0/14/28 deg, stop the diaphragm
  (the TOML's `stop = 5` counts from 1; the recorder passes position 4, typed `Aperture`, as phos does). Only the layout is recorded.
- `cassegrain-layout.json`: phos-core's tutorial Cassegrain (see the table); only the layout is recorded.

| File | Content |
| -- | -- |
| `<lens>-mtf.json` | polychromatic MTF (uniform weights), per source: `tangential` and `sagittal`, each `[cycles/mm, modulus][]`. Pupil sampling 64, zero pad 64. phos-core has no diffraction-limit curve: use `firstOrder.workingFNumber` (else `fNumber`) and `referenceWavelengthNm` |
| `<lens>-field-curvature.json` | per source, `results[]` per wavelength: `tangential`, `sagittal` focus shift (mm), `chiefHeight` (mm), `astigmatism` |
| `<lens>-distortion.json` | per source, `results[]` per wavelength: `realHeight`, `paraxialHeight` (mm), `percent` |
| `<lens>-spot.json` | SpotDiagram per source (the lens's own sources, as in the MTF file; pupil sampling 32 x 32), per source: `wavelengths` (nm), `points[w]` = `[x, y][]` in mm (the rays alive at the image, so fewer than 32 x 32 where vignetted; relative to the paraxial chief ray at the reference wavelength, the same origin for every wavelength, not the centroid), `enclosingRadius[w]` (smallest enclosing circle, mm) and `enclosingRadiusAll` (polychromatic). No centroid or RMS. Top-level `reference` and `pupilSampling`. About 180 kB (achromat) and 160 kB (Cooke); the gallery fetches the achromat one |
| `wandersleb-layout.json` | `visualize_system_2d` with 11 rays per field (recorded with `--only layout`): a `RecordedLayout` (`surfaces`: the seven surfaces then the image, each `z` the profile's middle point, `sd` its largest \|y\|, a 41-point `profile`, `stop` on the diaphragm (position 4), `glass: "crown"` after each lens's front surface else `null`; `rays[field][ray]`: `[z, y]` points, each ray cut at its first non-finite point; `chief`: the middle ray, 5) plus `alive[field][ray]`: the index of the first point whose status is not `ALIVE` among the kept points, else their count, and `dead[field][ray]`: true when that first non-`ALIVE` status is `DEAD_E`, else false (CR #372; the 14 deg lower ray only). Header: `prescription` (the TOML's tables), `fieldsDeg`, `rayCount`. The recorder refuses to write unless the 28 deg lower ray is `VIRTUAL` at S2 and the 14 deg lower ray does not reach the image alive (ELEOptics/phos#310) |
| `cassegrain-layout.json` | phos-core's tutorial Cassegrain (`models/src/example/cassegrain.rs`: parabolic primary R -187.5 k -1 with an annular aperture 10..55 mm, hyperbolic secondary R 600/13 k -361/169 75 mm from it, image 100 mm behind the secondary, EPD 100, 1.55 um, fields 0/0.35/0.5 deg), recorded with `--only layout` beside the Wandersleb file at the same sha, in the same shape (`surfaces` (the obscuration, primary, secondary and image; `glass` is always `null`, no `stop`; `mirror: true` on the primary and secondary, `obscuration: true` on the obscuration, each written only when true, so the Wandersleb file has neither; `hole: 10` on the primary, the inner radius of its annular aperture (CR #371)), `rays`, `chief` 5, `alive`, `dead` (true for rays 4-6 of each field, the ones the obscuration stops), header `prescription`, `fieldsDeg`, `rayCount`). The client has no `cassegrain()` constructor, so the recorder builds it with `InterfaceBuilder` (and `phos.material("MIRROR", "FICTIONAL")`); the path is folded, so the surface mapping of the Wandersleb file does not apply. The recorder refuses to write unless the 0 deg chief ray is not alive at the image |
| `<lens>-psf.json` | PointSpread at the 0 degree source (source index 0; recorded with `--only maps`, so at a later phos-core sha than the first files): pupil sampling 64 plus zero pad 64 on each side gives a 192 x 192 grid (the real size; the pad adds to the sampling). `values[row][column]` irradiance as `irradiance()` gives it, rows top-down as `coordinates()` gives them (row 0 at the largest y, columns ascending in x), `extent` `[x0, x1, y0, y1]` mm, the cell edges (half a pitch beyond the outer coordinates). Header: `fieldAngleDeg` 0, `pupilSampling`, `zeroPad`. About 440 kB each. The recorder refuses a grid that is not 192 x 192 or a `coordinates()` that is not row-major with that orientation |
| `<lens>-seidel.json` | SeidelCoefficients at the default chromatic lines (recorded with `--only seidel`, so at a later phos-core sha than the other files): `results[]` per wavelength (`wavelengthNm`), each with `terms`: `spherical`, `coma`, `astigmatism`, `fieldCurvature`, `distortion`, `axialColor`, `lateralColor` (SI to SV, CL, CT, in that order), each one value per surface then phos-core's total as the last element (mm). No sources or field angles |

The MTF files hold one source per lens field, with the angles read from each source's rotation. The field curvature
and distortion files hold an 11-source sweep: 11 sources evenly from 0 to the lens's largest field (0 to 2 deg for the
achromat, 0 to 24 deg for the Cooke), each a `RelativeSource` scaled in direction sine.

Common keys: `fieldAnglesDeg` (one per source; for the MTF files read from each source's rotation, for the field
curvature and distortion files the sweep angles), `wavelengthsNm`,
`referenceWavelengthNm`, `firstOrder` (`efl`, `bfl`, `epd`, `fNumber`, `workingFNumber`, `paraxialImageHeight`, mm),
`lengthUnit`, `phosCore.sha`, `script`, `args`. The Seidel files carry only `referenceWavelengthNm`, `lengthUnit` and
the header keys (`phosCore.sha`, `script`, `args`, `lens`, `analysis`, `kind`): no `fieldAnglesDeg`, `wavelengthsNm` or
`firstOrder`, their wavelengths being in `results[].wavelengthNm`. phos-core's results give image heights, not angles; each
`sources[i].fieldAngleDeg` is that source's angle (the sweep angle in the field curvature and distortion files).
