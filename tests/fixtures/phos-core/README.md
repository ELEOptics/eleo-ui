# phos-core recordings

Raw results of phos-core's Python client for two public lenses, recorded by `scripts/record-phos-core.py` (its
header says how to build the client with `clients/python/dev.sh`). Each file carries the phos-core commit sha and
the script's arguments. They are committed; the gate does not re-record them. Numbers are rounded to 6 significant
digits.

- `achromat-*`: the sample achromat (`packages/plots/src/sample.json`: N-BK7/SF5, R 62.8/-45.7/-128.2 mm, EPD 25 mm,
  fields 0/1/2 deg, 486.1/587.6/656.3 nm), built as a `LensTable`. Its efl is within 0.1% of `sample.efl` (the
  recording's own check, and `tests/unit/phos-core-fixtures.test.js`). Its back focal distance (97.22 mm) is not
  the sample's 97.126: the sample's image plane is the best on-axis RMS focus.
- `cooke-*`: `OpticalModel.cooke_triplet_kingslake()`, fields 0/17/24 deg, 450/550/650 nm.

| File | Content |
| --- | --- |
| `<lens>-mtf.json` | polychromatic MTF (uniform weights), per source: `tangential` and `sagittal`, each `[cycles/mm, modulus][]`. Pupil sampling 64, zero pad 64. phos-core has no diffraction-limit curve: use `firstOrder.fNumber` and `referenceWavelengthNm` |
| `<lens>-field-curvature.json` | per source, `results[]` per wavelength: `tangential`, `sagittal` focus shift (mm), `chiefHeight` (mm), `astigmatism` |
| `<lens>-distortion.json` | per source, `results[]` per wavelength: `realHeight`, `paraxialHeight` (mm), `percent` |

Common keys: `fieldAnglesDeg` (one per source, read from each source's rotation), `wavelengthsNm`,
`referenceWavelengthNm`, `firstOrder` (`efl`, `bfl`, `epd`, `fNumber`, `workingFNumber`, `paraxialImageHeight`, mm),
`lengthUnit`, `phosCore.sha`, `script`, `args`. phos-core's results give image heights, not angles; each
`sources[i].fieldAngleDeg` is that source's angle.
