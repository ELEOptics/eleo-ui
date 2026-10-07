# glasses.json

Test-only table of public catalog optical glasses for plan #90 (issue #91). Its rows feed O1's property test:
designs of 2 to 8 distinct glasses drawn from this table, filled by `glassFill`. It does not ship in any package
(plan #90, Non-goals).

## Columns

| Column | Meaning |
| -- | -- |
| `name` | The manufacturer's glass name, unique in the table |
| `catalog` | `Schott`, `Ohara` or `CDGM` |
| `nd` | Refractive index at the helium d line (587.56 nm), as the catalog states it |
| `vd` | Abbe number at d, rounded to two decimals (the data sheets' precision) |
| `source` | The row's record in the refractiveindex.info database, pinned to commit `c5c2f188` |

## Source

Each `source` URL is the glass's YAML record in
[refractiveindex.info-database](https://github.com/polyanskiy/refractiveindex.info-database) (public domain,
CC0) at commit `c5c2f188e848453def5970e347399d653df2ffc2`, retrieved 2026-10-06. `nd` and `Vd` are its
`PROPERTIES`, which the record's `REFERENCES` take from the manufacturer's own published Zemax catalog:

- Schott: SCHOTT Zemax catalog 2017-01-20b, from <https://www.schott.com/en-us/products/optical-glass-p1000267/downloads/>
- Ohara: OHARA Zemax catalog 2017-11-30, from <https://www.ohara-inc.co.jp>
- CDGM: CDGM Zemax catalog 2022-06, from <http://www.cdgmgd.com>

## Choices

- The rows span the glass map: fluor crowns (vd > 80) to dense flints (vd < 26), nd 1.487 to 1.851.
- No two rows share both `nd` and `vd`. Ohara S-TIH53 is left out: its values equal Schott N-SF57's.
- The classic Cooke triplet's SK16 is Schott's lead glass, now obsolete and not in these catalogs. Its
  lead-free replacement N-SK16 (same glass code, 620603) stands in for it. F2 is still in Schott's catalog.

## Refreshing

Fetch `database/data/specs/<vendor>/optical/<name>.yml` at a newer commit, read `nd` and `Vd` under
`PROPERTIES`, and update the commit in every `source` and here. `tests/unit/glass-table.test.js` checks the shape.
