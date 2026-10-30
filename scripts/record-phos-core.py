#!/usr/bin/env python3
"""Record phos-core analyses of the public lenses as JSON fixtures for the plots.

Records, for the sample achromat and for OpticalModel.cooke_triplet_kingslake(): the polychromatic MTF,
field curvature and distortion per source (over 11 field angles evenly from 0 to the largest field), the spot diagram per
source (pupil sampling 32, points in mm), first-order data, the field angle of each source and the wavelengths.
Writes tests/fixtures/phos-core/{achromat,cooke}-{mtf,field-curvature,distortion,spot}.json.
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

--only <analysis> records one analysis alone and leaves the other fixtures untouched, so a rerun at a newer phos-core
does not rewrite them:
  `seidel`: SeidelCoefficients, default chromatic lines, per wavelength the seven terms per surface with phos-core's
    total last. Writes tests/fixtures/phos-core/{achromat,cooke}-seidel.json.
  `layout`: the Wandersleb triplet (US 1,073,789, from phos's fixtures/triplet.toml, which it copies to
    tests/fixtures/phos-core/wandersleb.toml; --triplet gives another path, and a missing one falls back to that committed copy) drawn by visualize_system_2d with 11 rays per
    field, as a RecordedLayout plus `alive`. Writes tests/fixtures/phos-core/wandersleb-layout.json.
    It also records phos-core's tutorial Cassegrain (models/src/example/cassegrain.rs: parabolic primary with an annular
    aperture, hyperbolic secondary, obscuration; fields 0/0.35/0.5 deg), built through InterfaceBuilder, in the same shape
    without `glass` and with `mirror` on the two mirrors and `obscuration` on the obscuration, as tests/fixtures/phos-core/cassegrain-layout.json. It exits non-zero unless the 0 degree chief is dead before the image.
"""
import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIG = 6
PUPIL_SAMPLING = 64  # pupil samples and zero pads of the MTF, per axis
SPOT_SAMPLING = 32  # pupil samples of the spot diagram, per axis
SWEEP = 11  # field angles of field curvature and distortion, evenly from 0 to the lens's largest field


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


def sweep_sources(phos, angles):
    # A RelativeSource indexes a model source and scales its field in direction-sine space: relative_y = sin(angle) / sin(that
    # source's angle) (found by comparing heights with the lens's own 1 and 2 degree sources). Index the largest field.
    top = max(range(len(angles)), key=lambda i: angles[i])
    sweep = [angles[top] * k / (SWEEP - 1) for k in range(SWEEP)]
    sin_top = math.sin(math.radians(angles[top]))
    return [phos.RelativeSource(top, 0.0, math.sin(math.radians(a)) / sin_top, None) for a in sweep], [rnd(a) for a in sweep]


def field_curvature(phos, model, sources):
    s = phos.FieldCurvatureSettings()
    s.set_system_index(0)
    s.set_sources(sources)
    return [
        [{"wavelengthNm": rnd(r.wavelength * 1000), "tangential": rnd(r.tangential), "sagittal": rnd(r.sagittal),
          "chiefHeight": rnd(r.chief_height), "astigmatism": rnd(r.astigmatism)} for r in a.results()]
        for a in s.run(model)
    ]


def distortion(phos, model, sources):
    s = phos.DistortionSettings()
    s.set_system_index(0)
    s.set_sources(sources)
    return [
        [{"wavelengthNm": rnd(r.wavelength * 1000), "realHeight": rnd(r.real_height),
          "paraxialHeight": rnd(r.paraxial_height), "percent": rnd(r.percent)} for r in a.results()]
        for a in s.run(model)
    ]


def spot(phos, model):
    # ray_errors(): one list per wavelength of the rays alive at the image, mm, relative to the paraxial chief ray at the
    # reference wavelength. enclosing_radius(i): smallest enclosing circle in mm; None is the polychromatic one.
    s = phos.SpotDiagramSettings()
    s.set_system_index(0)
    s.set_pupil_sampling_x(SPOT_SAMPLING)
    s.set_pupil_sampling_y(SPOT_SAMPLING)
    out = []
    for a in s.run(model):
        wl = a.wavelengths()
        out.append({"sourceIndex": a.source_index(), "wavelengths": [rnd(w * 1000) for w in wl],
                    "points": [pts(p) for p in a.ray_errors()],
                    "enclosingRadius": [rnd(a.enclosing_radius(i)) for i in range(len(wl))],
                    "enclosingRadiusAll": rnd(a.enclosing_radius(None))})
    return out


SEIDEL_TERMS = ("spherical", "coma", "astigmatism", "field_curvature", "distortion", "axial_color", "lateral_color")


def camel(name):
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


def seidel(phos, lens, model, ref_nm, outdir, header):
    # SeidelCoefficients.results(): one entry per wavelength (the default chromatic lines), each term a list of values per
    # surface with phos-core's total as the last element.
    s = phos.SeidelSettings()
    s.set_system_index(0)
    run = s.run(model)
    results = run.results()
    if not results:
        sys.exit(f"{lens} seidel: no results")
    n = None
    out = []
    for r in results:
        terms = {camel(k): [rnd(v) for v in getattr(r, k)] for k in SEIDEL_TERMS}
        for k, t in terms.items():
            n = len(t) if n is None else n
            if len(t) != n or n < 2:
                sys.exit(f"{lens} seidel {k} at {r.wavelength} um: {len(t)} values, expected the surface count plus one ({n})")
        out.append({"wavelengthNm": rnd(r.wavelength * 1000), "terms": terms})
    doc = {**header, "lens": lens, "analysis": "seidel", "referenceWavelengthNm": ref_nm, "lengthUnit": "mm",
           "kind": "per wavelength, per term one value per surface then phos-core's total", "results": out}
    path = outdir / f"{lens}-seidel.json"
    path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    return path


LAYOUT_RAYS = 11  # rays per field of the recorded layout; the middle one (5) is the chief
LAYOUT_SAMPLES = 41  # points per surface profile
DEFAULT_TRIPLET = Path.home() / "code/ELEOptics/phos/fixtures/triplet.toml"


def finite(*xs):
    return all(math.isfinite(x) for x in xs)


def layout_rays(phos, res, n_fields, tag):
    # Per field, per ray: the points kept up to the first non-finite one, the index of the first kept point whose status is not
    # ALIVE (else the count), and every point's status name.
    rays, alive, status = [], [], []
    sources = res.ray_data.sources
    if len(sources) != n_fields:
        sys.exit(f"{tag}: {len(sources)} sources for {n_fields} fields")
    for src in sources:
        fan, fan_alive, fan_status = [], [], []
        for ray in src.rays:
            kept = []
            for p in ray.interfaces:
                if not finite(p.x, p.y):
                    break
                kept.append(p)
            if not kept:
                sys.exit(f"{tag}: field {len(rays)} ray {len(fan)} has a non-finite first point, expected every kept ray non-empty")
            fan.append([[rnd(p.x), rnd(p.y)] for p in kept])
            fan_alive.append(next((k for k, p in enumerate(kept) if not isinstance(p.status, phos.RayStatus.ALIVE)), len(kept)))
            fan_status.append([type(p.status).__name__.split(".")[-1] for p in ray.interfaces])
        rays.append(fan)
        alive.append(fan_alive)
        status.append(fan_status)
    return rays, alive, status


def wandersleb(phos, triplet, outdir, header):
    # Built as phos does (phos src-tauri/src/prescription.rs lens_table): radius 0 is plano (inf), the glasses are constant
    # index, the TOML's 1-based `stop` is a position in `surfaces`, and a plano stop is typed Aperture. Without that type
    # the diaphragm clips nothing and the profiles are sized by dead rays (NaN at the rim).
    import tomllib  # Python 3.11+, imported here so the other modes run on older Pythons

    dest = outdir / "wandersleb.toml"
    if not triplet.exists():
        committed = ROOT / "tests/fixtures/phos-core/wandersleb.toml"
        if not committed.exists():
            sys.exit(f"wandersleb: {triplet} does not exist and there is no committed copy; pass --triplet <phos>/fixtures/triplet.toml")
        triplet = committed
    if triplet.resolve() != dest.resolve():
        shutil.copyfile(triplet, dest)
    t = tomllib.loads(dest.read_text())
    stop = t["stop"] - 1
    rows = t["surfaces"]
    surfs = []
    for i, r in enumerate(rows):
        plano = r["radius"] == 0.0
        surfs.append(phos.Surf(
            radius=math.inf if plano else r["radius"], thickness=r["thickness"],
            material=phos.MaterialSpec.CONSTANT(name=f"n{i}", index=r["index"]),
            interface_type=phos.InterfaceType.aperture() if plano and i == stop else None))
    wl = t["wavelength_nm"] / 1000
    table = phos.LensTable(
        wavelengths=[wl], reference_wavelength=wl, aperture=phos.SystemAperture.entrance_pupil_diameter(t["epd"]), stop=stop,
        fields=phos.FieldSpec.ANGLES(values=[float(f) for f in t["fields_deg"]]), object=phos.ObjectDistance.INFINITY(),
        surfaces=surfs, image=0.0)
    model = phos.OpticalModel.from_lens_table(table)
    res = model.visualize_system_2d(0, LAYOUT_SAMPLES, LAYOUT_RAYS)

    # phos-core lists elements as consecutive interface pairs (each interface twice, but the last two), so the first
    # interface of every element is one surface each, the detector last. Air-spaced: no cemented dedup.
    els = res.system.elements
    profiles = [e.interfaces[0].points for e in els]
    if len(profiles) != len(rows) + 1:
        sys.exit(f"wandersleb: {len(profiles)} surfaces, expected the table's {len(rows)} and the image")
    surfaces = []
    for i, prof in enumerate(profiles):
        prof = [[rnd(x), rnd(y)] for x, y in prof if finite(x, y)]
        if len(prof) != LAYOUT_SAMPLES:
            sys.exit(f"wandersleb surface {i}: {len(prof)} finite profile points, expected {LAYOUT_SAMPLES}")
        surfaces.append({"z": prof[len(prof) // 2][0], "sd": max(abs(y) for _, y in prof), "stop": i == stop, "image": i == len(rows),
                         "glass": "crown" if i < len(rows) and rows[i]["index"] != 1 else None, "profile": prof})

    rays, alive, status = layout_rays(phos, res, len(t["fields_deg"]), "wandersleb")

    # phos#310's two facts, which the Python client must reproduce for the fixture to show anything.
    lower = lambda fan: min(range(len(fan)), key=lambda j: fan[j][0][1])
    l28, l14 = lower(rays[2]), lower(rays[1])
    if status[2][l28][2] != "VIRTUAL":
        sys.exit(f"wandersleb: the 28 degree lower ray is {status[2][l28][2]} at S2, expected VIRTUAL (statuses {status[2][l28]})")
    if alive[1][l14] >= len(rays[1][l14]) or status[1][l14][-1] == "ALIVE":
        sys.exit(f"wandersleb: the 14 degree lower ray reaches the image alive (statuses {status[1][l14]}), expected it vignetted")

    doc = {**header, "lens": "wandersleb", "analysis": "layout", "kind": "visualize_system_2d, 11 rays per field, [z, y] mm",
           "prescription": {"source": t["source"], "epd": t["epd"], "wavelengthNm": t["wavelength_nm"], "stop": t["stop"],
                            "surfaces": rows, "file": "wandersleb.toml"},
           "fieldsDeg": [rnd(f) for f in t["fields_deg"]], "rayCount": LAYOUT_RAYS, "lengthUnit": "mm",
           "surfaces": surfaces, "rays": rays, "chief": [LAYOUT_RAYS // 2] * len(rays), "alive": alive}
    path = outdir / "wandersleb-layout.json"
    path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    return path


CASSEGRAIN_FIELDS = [0.0, 0.35, 0.5]  # degrees; phos-core's tutorial Cassegrain


def cassegrain(phos, outdir, header):
    # Built as phos-core's models/src/example/cassegrain.rs builds it (the client has no cassegrain() constructor, and
    # insert_interface_direct takes an Interface the client cannot construct, so the equivalent InterfaceBuilder.insert):
    # EPD 100, 1.55 um, three sources, the parabolic primary with an annular aperture, the hyperbolic secondary 75 mm
    # in front of it, the image 100 mm behind the secondary and the secondary's obscuration inserted first.
    wl = 1.55
    air = phos.material("AIR", "FICTIONAL")
    mirror = phos.material("MIRROR", "FICTIONAL")  # MaterialSpec.MIRROR's database entry
    model = phos.empty_model_with_system()
    model.set_system_aperture(0, phos.SystemAperture.entrance_pupil_diameter(100.0))
    model.set_reference_wavelength(0, wl)
    boundary = None
    for deg in CASSEGRAIN_FIELDS:
        src = phos.SourceBuilder()
        src.set_wavelengths([wl])
        if boundary is not None:  # each direction turns the previous source's frame; the boundary is set before the direction
            src.set_boundary(boundary)
        if deg:
            src.set_direction(phos.spherical_vector(math.radians(deg), math.pi / 2))
        i = model.add_source_builder(0, src)
        if boundary is None:
            boundary = model.source(0, i).boundary()

    def insert(surface=None, material=air, aperture=None, ref=None, dz=None, at=None):
        b = phos.InterfaceBuilder()
        b.set_system_index(0)
        if surface is not None:
            b.set_surface(surface)
        b.set_interior_material(material)
        if aperture is not None:
            b.set_aperture(aperture)
        if ref is not None:
            b.set_reference_interface(ref)
        if dz is not None:
            b.set_translation([0.0, 0.0, dz])
        if at is not None:
            b.set_insert_at(at)
        b.insert(model)

    insert(phos.Surface.conic(-187.5, -1.0), mirror, phos.Aperture.annular("primary aperture", [0.0, 0.0], 10.0, 55.0, False, False, None))
    insert(phos.Surface.conic(600.0 / 13.0, -361.0 / 169.0), mirror, ref=0, dz=75.0)
    insert(ref=1, dz=100.0)
    semi = model.interface(0, 1).aperture().extent().width / 2  # the secondary's auto-sized aperture
    sag = model.interface(0, 1).sag([0.0, semi])
    insert(aperture=phos.Aperture.circular("obscuration", [0.0, 0.0], semi, False, True, None), ref=1, dz=-sag, at=0)

    res = model.visualize_system_2d(0, LAYOUT_SAMPLES, LAYOUT_RAYS)
    profiles = [e.interfaces[0].points for e in res.system.elements]
    if len(profiles) != 4:
        sys.exit(f"cassegrain: {len(profiles)} surfaces, expected the obscuration, primary, secondary and image")
    surfaces = []
    for i, prof in enumerate(profiles):
        prof = [[rnd(x), rnd(y)] for x, y in prof if finite(x, y)]
        if len(prof) != LAYOUT_SAMPLES:
            sys.exit(f"cassegrain surface {i}: {len(prof)} finite profile points, expected {LAYOUT_SAMPLES}")
        surfaces.append({"z": prof[len(prof) // 2][0], "sd": max(abs(y) for _, y in prof), "stop": False, "image": i == len(profiles) - 1,
                         "glass": None, "profile": prof})
    # CR #360: the flags come from what was built (surface 0 the obscuration, 1 and 2 the MIRROR primary and secondary),
    # written only when true so the Wandersleb recording stays as it was.
    # Each flagged interface is checked against what phos-core reports, so a change of its element order fails here: the
    # mirrors by material name, the obscuration by its aperture (extent width 2 * semi, the one built above, not the
    # primary's 110 mm; the client does not expose is_opaque).
    for i in (1, 2):
        name = model.interface(0, i).interior_material().name()
        if name != "MIRROR":
            sys.exit(f"cassegrain: interface {i} has material {name}, expected MIRROR")
    width = model.interface(0, 0).aperture().extent().width
    if abs(width - 2 * semi) > 1e-9 * semi:
        sys.exit(f"cassegrain: interface 0 has aperture width {width}, expected the obscuration's {2 * semi}")
    surfaces[0]["obscuration"] = True
    surfaces[1]["mirror"] = surfaces[2]["mirror"] = True
    rays, alive, status = layout_rays(phos, res, len(CASSEGRAIN_FIELDS), "cassegrain")
    chief = status[0][LAYOUT_RAYS // 2]
    if alive[0][LAYOUT_RAYS // 2] >= len(chief) - 1 or chief[-1] == "ALIVE":
        sys.exit(f"cassegrain: the 0 degree chief ray stays alive before the image (statuses {chief}), expected the obscuration to stop it")

    doc = {**header, "lens": "cassegrain", "analysis": "layout", "kind": "visualize_system_2d, 11 rays per field, [z, y] mm",
           "prescription": {"source": "phos-core models/src/example/cassegrain.rs", "epd": 100.0, "wavelengthNm": 1550.0,
                            "primary": {"radius": -187.5, "conic": -1.0, "aperture": "annular 10..55 mm", "material": "MIRROR"},
                            "secondary": {"radius": rnd(600.0 / 13.0), "conic": rnd(-361.0 / 169.0), "distanceFromPrimary": 75.0, "material": "MIRROR"},
                            "imageDistanceFromSecondary": 100.0, "obscuration": "circular, the secondary's semi-diameter, in front of the primary"},
           "fieldsDeg": CASSEGRAIN_FIELDS, "rayCount": LAYOUT_RAYS, "lengthUnit": "mm",
           "surfaces": surfaces, "rays": rays, "chief": [LAYOUT_RAYS // 2] * len(rays), "alive": alive}
    path = outdir / "cassegrain-layout.json"
    path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    return path


def record(phos, lens, model, meta, outdir, header):
    srcs = model.sources(0)
    angles = [rnd(field_angle_deg(s)) for s in srcs]
    wl_um = [e.wavelength() for e in srcs[0].emission_data()]
    head = {**header, "lens": lens, "firstOrder": first_order(model)}
    tail = {
        "wavelengthsNm": [rnd(w * 1000) for w in wl_um], "referenceWavelengthNm": meta["referenceNm"],
        "lengthUnit": "mm",
    }
    sweep, sweep_angles = sweep_sources(phos, angles)
    results = {
        "mtf": (mtf(phos, model), angles, {"frequencyUnit": "cycles/mm", "pupilSampling": PUPIL_SAMPLING, "kind": "polychromatic, uniform weights"}),
        "field-curvature": (field_curvature(phos, model, sweep), sweep_angles, {"focusUnit": "mm", "kind": "per source, one entry per wavelength"}),
        "distortion": (distortion(phos, model, sweep), sweep_angles, {"percentUnit": "%", "kind": "per source, one entry per wavelength"}),
        "spot": (spot(phos, model), angles, {"pupilSampling": SPOT_SAMPLING, "reference": "paraxial chief ray at the reference wavelength",
                                             "kind": "per source, points per wavelength: the rays alive at the image"}),
    }
    for name, (per_source, src_angles, extra) in results.items():
        if len(per_source) != len(src_angles):
            sys.exit(f"{lens} {name}: {len(per_source)} results for {len(src_angles)} sources, expected one each")
        doc = {**head, "fieldAnglesDeg": src_angles, **tail, "analysis": name, **extra,
               "sources": [{"fieldAngleDeg": a, **(r if isinstance(r, dict) else {"results": r})} for a, r in zip(src_angles, per_source)]}
        path = outdir / f"{lens}-{name}.json"
        path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
        yield path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--phos", required=True, help="<phos-core>/clients/python/src")
    default_out = str(ROOT / "tests/fixtures/phos-core")
    ap.add_argument("--out", default=default_out)
    ap.add_argument("--only", choices=["seidel", "layout"], help="record only this analysis; the other fixtures are left as they are")
    ap.add_argument("--triplet", default=str(DEFAULT_TRIPLET), help="phos's fixtures/triplet.toml (--only layout)")
    args = ap.parse_args()
    sys.path.insert(0, args.phos)
    import phos  # noqa: E402

    core = Path(args.phos).resolve().parents[2]
    sha = subprocess.check_output(["git", "-C", str(core), "rev-parse", "HEAD"], text=True).strip()
    header = {"phosCore": {"sha": sha}, "script": "scripts/record-phos-core.py",
              "args": ["--phos", "<phos>"] + ([] if args.out == default_out else ["--out", "<out>"]) + (["--only", args.only] if args.only else [])}
    if args.only == "layout":
        outdir = Path(args.out)
        outdir.mkdir(parents=True, exist_ok=True)
        shown = outdir.relative_to(ROOT) if outdir.is_relative_to(ROOT) else outdir
        for path in (wandersleb(phos, Path(args.triplet), outdir, header), cassegrain(phos, outdir, header)):
            print(f"wrote {shown}/{path.name} (phos-core {sha[:10]})")
        return
    sample = json.loads((ROOT / "packages/plots/src/sample.json").read_text())

    ach = achromat(phos, sample)
    efl = ach.first_order_data(0).focal_length()
    if abs(efl - sample["efl"]) / sample["efl"] > 0.001:
        sys.exit(f"the lens table is not the sample achromat: efl {efl} vs sample.efl {sample['efl']}")
    cooke = phos.OpticalModel.cooke_triplet_kingslake()

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    written = []
    shown = outdir.relative_to(ROOT) if outdir.is_relative_to(ROOT) else outdir
    for lens, model in (("achromat", ach), ("cooke", cooke)):
        ref_um = model.system(0).reference_wavelength()
        if ref_um is None:
            sys.exit(f"{lens}: the model has no reference wavelength")
        if args.only == "seidel":
            written.append(seidel(phos, lens, model, rnd(ref_um * 1000), outdir, header))
            continue
        written += list(record(phos, lens, model, {"referenceNm": rnd(ref_um * 1000)}, outdir, header))
    if args.only == "seidel":
        print(f"wrote {shown}/{{achromat,cooke}}-seidel.json (phos-core {sha[:10]})")
        return
    print(f"wrote {shown}/{{achromat,cooke}}-{{mtf,field-curvature,distortion,spot}}.json (phos-core {sha[:10]})")


if __name__ == "__main__":
    main()
