#!/usr/bin/env python3
"""Record phos-core analyses of the public lenses as JSON fixtures for the plots.

Records, for the sample achromat and for OpticalModel.cooke_triplet_kingslake(): the polychromatic MTF,
field curvature and distortion per source, first-order data, the field angle of each source and the
wavelengths. Writes tests/fixtures/phos-core/{achromat,cooke}-{mtf,field-curvature,distortion}.json.
Numbers are rounded to 6 significant digits. Not part of the gate: the fixtures are committed.

Build the client first (phos-core is not vendored here):

    gh repo clone ELEOptics/phos-core && bash phos-core/clients/python/dev.sh

dev.sh builds the cdylib and the bindings (cargo, a few minutes) but does not copy the glass catalogs.
Copy them as clients/python/README.md describes, or the first Surf with a catalog glass fails to load:

    mkdir -p phos-core/clients/python/src/phos/data
    cp phos-core/materials/catalogs.json phos-core/clients/python/src/phos/data/
    cp -r phos-core/materials/data phos-core/clients/python/src/phos/data/

Run from the repo root:

    python3 scripts/record-phos-core.py --phos <phos-core>/clients/python/src
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIG = 6
PUPIL_SAMPLING = 64  # pupil samples and zero pads of the MTF, per axis


def rnd(x):
    return float(f"{x:.{SIG}g}")


def pts(points):
    return [[rnd(p[0]), rnd(p[1])] for p in points]


def field_angle_deg(source):
    # The source's rotation is a quaternion (x, y, z, w) about the x axis.
    x, _, _, w = source.boundary().rotation()
    return abs(2 * math.degrees(math.atan2(x, w)))


def achromat(phos, sample):
    bk = phos.MaterialSpec.CATALOG(name="N-BK7", vendor="SCHOTT")
    sf = phos.MaterialSpec.CATALOG(name="SF5", vendor="SCHOTT")
    air = phos.MaterialSpec.AIR()
    rx = [r for r in sample["rx"] if isinstance(r["R"], (int, float))]  # STO, 2, 3
    glass = {"N-BK7": bk, "SF5": sf, "": air}
    table = phos.LensTable(
        wavelengths=[w / 1000 for w in sample["wl"]],
        reference_wavelength=sample["wl"][1] / 1000,
        aperture=phos.SystemAperture.entrance_pupil_diameter(25.0),  # sample.json has no EPD field
        stop=0,
        fields=phos.FieldSpec.ANGLES(values=[float(f) for f in sample["fields"]]),
        object=phos.ObjectDistance.INFINITY(),
        surfaces=[phos.Surf(radius=r["R"], thickness=r["t"], material=glass[r["g"]]) for r in rx],
    )
    return phos.OpticalModel.from_lens_table(table)


def first_order(model):
    p = model.get_metadata(0).performance
    return {
        "efl": rnd(p.effective_focal_length),
        "bfl": rnd(p.back_focal_distance),
        "epd": rnd(p.entrance_pupil_diameter),
        "fNumber": rnd(p.f_number),
        "workingFNumber": rnd(p.working_f_number),
        "paraxialImageHeight": rnd(p.paraxial_image_height),
    }


def mtf(phos, model):
    s = phos.PolychromaticModulationTransferSettings()
    s.set_system_index(0)
    for setter in ("pupil_sampling_x", "pupil_sampling_y", "psf_zero_pad_x", "psf_zero_pad_y", "zero_pad_x", "zero_pad_y"):
        getattr(s, "set_" + setter)(PUPIL_SAMPLING)
    s.set_sources(model.relative_sources(0))
    runs = s.run(model)
    return [
        {"sourceIndex": a.source_index(), "weights": [rnd(w) for w in a.weights()],
         "tangential": pts(a.tangential()), "sagittal": pts(a.sagittal())}
        for a in runs
    ]


def field_curvature(phos, model):
    s = phos.FieldCurvatureSettings()
    s.set_system_index(0)
    s.set_sources(model.relative_sources(0))
    return [
        [{"wavelengthNm": rnd(r.wavelength * 1000), "tangential": rnd(r.tangential), "sagittal": rnd(r.sagittal),
          "chiefHeight": rnd(r.chief_height), "astigmatism": rnd(r.astigmatism)} for r in a.results()]
        for a in s.run(model)
    ]


def distortion(phos, model):
    s = phos.DistortionSettings()
    s.set_system_index(0)
    s.set_sources(model.relative_sources(0))
    return [
        [{"wavelengthNm": rnd(r.wavelength * 1000), "realHeight": rnd(r.real_height),
          "paraxialHeight": rnd(r.paraxial_height), "percent": rnd(r.percent)} for r in a.results()]
        for a in s.run(model)
    ]


def record(phos, lens, model, meta, outdir, header):
    srcs = model.sources(0)
    angles = [rnd(field_angle_deg(s)) for s in srcs]
    wl_um = [e.wavelength() for e in srcs[0].emission_data()]
    base = {
        **header, "lens": lens, "firstOrder": first_order(model), "fieldAnglesDeg": angles,
        "wavelengthsNm": [rnd(w * 1000) for w in wl_um], "referenceWavelengthNm": meta["referenceNm"],
        "lengthUnit": "mm",
    }
    results = {
        "mtf": (mtf(phos, model), {"frequencyUnit": "cycles/mm", "pupilSampling": PUPIL_SAMPLING, "kind": "polychromatic, uniform weights"}),
        "field-curvature": (field_curvature(phos, model), {"focusUnit": "mm", "kind": "per source, one entry per wavelength"}),
        "distortion": (distortion(phos, model), {"percentUnit": "%", "kind": "per source, one entry per wavelength"}),
    }
    for name, (per_source, extra) in results.items():
        assert len(per_source) == len(angles), f"{lens} {name}: one result per source"
        doc = {**base, "analysis": name, **extra,
               "sources": [{"fieldAngleDeg": a, **(r if isinstance(r, dict) else {"results": r})} for a, r in zip(angles, per_source)]}
        path = outdir / f"{lens}-{name}.json"
        path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
        yield path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--phos", required=True, help="<phos-core>/clients/python/src")
    ap.add_argument("--out", default=str(ROOT / "tests/fixtures/phos-core"))
    args = ap.parse_args()
    sys.path.insert(0, args.phos)
    import phos  # noqa: E402

    core = Path(args.phos).resolve().parents[2]
    sha = subprocess.check_output(["git", "-C", str(core), "rev-parse", "HEAD"], text=True).strip()
    header = {"phosCore": {"sha": sha}, "script": "scripts/record-phos-core.py",
              "args": ["--phos", "<phos-core>/clients/python/src"]}
    sample = json.loads((ROOT / "packages/plots/src/sample.json").read_text())

    ach = achromat(phos, sample)
    efl = ach.first_order_data(0).focal_length()
    if abs(efl - sample["efl"]) / sample["efl"] > 0.001:
        sys.exit(f"the lens table is not the sample achromat: efl {efl} vs sample.efl {sample['efl']}")
    cooke = phos.OpticalModel.cooke_triplet_kingslake()

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    written = []
    for lens, model, ref in (("achromat", ach, sample["wl"][1]), ("cooke", cooke, 550.0)):
        written += list(record(phos, lens, model, {"referenceNm": rnd(ref)}, outdir, header))
    print(f"wrote {outdir.relative_to(ROOT) if outdir.is_relative_to(ROOT) else outdir}/{{achromat,cooke}}-{{mtf,field-curvature,distortion}}.json (phos-core {sha[:10]})")


if __name__ == "__main__":
    main()
