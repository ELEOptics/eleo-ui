# @eleoptics/tokens

## 0.3.0

### Minor Changes

- aaac1be: New tokens `map-grid-<map>` and `map-grid-<map>-minor` for `ember`, `wave`, `viridis` and `gray`, light and dark: grid lines over a map image. Each holds 2:1 (minor 1.3:1) or more against its map's lowest and highest stops, and under 2.6:1 (minor 1.7:1) against its ground stop (`ember` stop 0, `wave` stop 4) or, for `viridis` and `gray`, the nearer end stop.

## 0.2.0

### Minor Changes

- 36557b0: New color tokens `glass-band-hi` and `glass-band-lo` (light and dark values): the lightest and darkest ends of the glass-blue band that `@eleoptics/plots` fills per-glass lenses within.
