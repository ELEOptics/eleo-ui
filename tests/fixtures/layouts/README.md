# Recorded layouts

The five lens layouts eleoptics.com draws, as recorded by its `scripts/layout.py`, taken from
ELEOptics/eleo-website at commit `39d19e4` (`39d19e4ba00348b245d3defca8d3449863efa149`). They are the oracle for `layout2D` on the recorded format
(plan #30, O1: `tests/unit/layout2d.test.js`).

| File | Source |
| -- | -- |
| `analysis.json` | `public/phos-core-runs.js`, run `analysis`, `output.layout` (Cooke triplet; one fan has 5 rays) |
| `merit-before.json` | `public/phos-core-runs.js`, run `merit`, `output.layout_before` (singlet, standalone stop) |
| `merit-after.json` | `public/phos-core-runs.js`, run `merit`, `output.layout_after` (singlet, standalone stop) |
| `focus.json` | `public/phos-core-runs.js`, run `focus`, `output.layout` (singlet, standalone stop) |
| `tolerance.json` | `public/services-tool.js`, `results.layout` (Cooke triplet) |

Format, in mm, YZ section: `{surfaces: [{z, sd, stop, image, glass: null|"crown"|"flint", profile: [[z, y] × 41]}], rays: [field][ray][[z, y]…]}`.
`glass` is the material after the surface.

## Derived

| File | Derivation |
| -- | -- |
| `analysis-glasses.json` | `analysis.json` with each `"crown"` replaced by N-SK16 and each `"flint"` by F2, as `{name, nd, vd}` copied from `tests/fixtures/glasses.json`; geometry and rays unchanged (plan #90, #97). The classic Cooke triplet's glasses; N-SK16 stands in for the obsolete SK16 (#91). Drawn by the gallery's "Layout2D · Cooke triplet, glasses" tile |

`glass` may also be a `{name, nd, vd}` object. To regenerate the derived file:

```sh
node -e 'const fs=require("fs"),d="tests/fixtures/",L=JSON.parse(fs.readFileSync(d+"layouts/analysis.json")),G=JSON.parse(fs.readFileSync(d+"glasses.json")),m={crown:"N-SK16",flint:"F2"};for(const s of L.surfaces)if(s.glass){const{name,nd,vd}=G.find(g=>g.name===m[s.glass]);s.glass={name,nd,vd}}fs.writeFileSync(d+"layouts/analysis-glasses.json",JSON.stringify(L)+"\n")'
```

To regenerate, check out the website at that commit and run the script, which parses the two files as
JSON (it never runs them):

```sh
git clone https://github.com/ELEOptics/eleo-website /tmp/eleo-website
git -C /tmp/eleo-website checkout 39d19e4ba00348b245d3defca8d3449863efa149
node tests/fixtures/layouts/extract.mjs /tmp/eleo-website
```
