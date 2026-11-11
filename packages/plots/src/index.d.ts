/* @eleoptics/plots. SVG output reads colors from tokens.css
   variables, except the typed `map2D(props)`, which returns SVG with its grid baked into one image at draw time: draw it
   again after a theme or palette change. The sample `map2D(canvas, ...)` and `layout3D` are canvas renderers that read
   the variables at draw time, so call them again after a theme or palette change. */

export type IndexKey = "field" | "wavelength";

/** The z and y extent a layout2D drawing shows, in mm. */
export interface LayoutBox { zmin: number; zmax: number; ylo: number; yhi: number }
/** A catalog glass: layout2D gives each distinct name its own fill in the glass-blue band. */
export interface Glass { name: string; nd: number; vd: number }
/** One surface of a recorded layout, in mm. */
export interface RecordedSurface {
  z: number;
  /** Semi-diameter. */
  sd: number;
  stop: boolean;
  image: boolean;
  /** The glass between this surface and the next, or null for air. "crown" and "flint" draw the two glass tokens. */
  glass: "crown" | "flint" | Glass | null;
  /** The surface's section as [z, y] points (41 from eleoptics.com's layout.py). */
  profile: [number, number][];
  /** The surface reflects: layout2D draws it as a hatched body with a flat back D/8 away from the light. */
  mirror?: boolean;
  /** An opaque disc at `z` of semi-diameter `sd`: layout2D draws it as an opaque bar. */
  obscuration?: boolean;
  /** The inner semi-diameter of an annular surface, e.g. a Cassegrain primary: layout2D leaves `|y| < hole` open. Needs 0 ≤ hole < sd. */
  hole?: number;
}
/** A ray point's status, by the Rust `RayStatus` names. A `Missed` point is non-finite and never kept in a layout. */
export type RayStatus = "Alive" | "Virtual" | "Dead";
/** A layout as eleoptics.com's scripts/layout.py records it, in mm. */
export interface RecordedLayout {
  surfaces: RecordedSurface[];
  /** rays[field][ray] is a polyline of [z, y] points. */
  rays: [number, number][][][];
  /** One ray index per fan; without it, the chief is the middle ray, floor(n / 2). */
  chief?: number[];
  /** alive[field][ray] is the number of leading alive points of rays[field][ray] (after the cut at the first non-finite point), an integer in 0..length; layout2D draws the rest dotted. Absent means every point alive. Ignored when `status` is present. */
  alive?: number[][];
  /** dead[field][ray] is true when that ray's first non-alive status is Dead (vignetted or obscured): layout2D draws it solid through point `alive[field][ray]` with no tail. Valid only with `alive`. Ignored when `status` is present. */
  dead?: boolean[][];
  /** status[field][ray][point] is the status of each kept point of rays[field][ray]; one entry per point. */
  status?: RayStatus[][][];
}
/** A traced system carrying recorded layouts: `layout` by field, `layoutWl` by wavelength. */
export interface LayoutSystem { layout?: RecordedLayout; layoutWl?: RecordedLayout; [key: string]: unknown }

export interface Layout2DProps {
  /** A recorded layout, or a system carrying one; defaults to ELEO.sample. */
  data?: RecordedLayout | LayoutSystem;
  /** What the drawing shows, in mm; drawings with one box, width and labels share a scale. Default layoutBounds([layout]). */
  box?: LayoutBox;
  /** What the index colors mean. Default "field". */
  colorBy?: IndexKey;
  /** Ray set per group. Default "marginal-chief" (3 rays). */
  rays?: "marginal-chief" | "fan" | "chief";
  /** Drawing width in px; the drawing is always true scale. Default 1000. Labels and the scale bar are `width / 70` px from 630 to 910, then grow as `13 * sqrt(width / 910)`, and are not drawn below 630, nor are the STO and IMA marks (ADR-0003). Ray strokes are 1 px up to 910, then `sqrt(width / 910)`. */
  width?: number;
  /** One text per fan, drawn 0.6 em past the image plane, beside the end of that fan's chief ray, with room kept for them (0.6 em and 0.6 em a character of the longest, on the right; an East Asian wide character counts as two). Below a width of 630 the labels are not drawn and no room is kept. An empty fan gets none. A null or undefined entry skips that fan; more labels than fans throws. Default none. */
  labels?: (string | null | undefined)[];
  /** Draw the STO and IMA labels (not drawn below a width of 630). Default true. */
  marks?: boolean;
  /** The statuses drawn. Default all three. */
  show?: RayStatus[];
  /** A key row under the scale bar, in the SVG at the layout's text size: entries (a line swatch in idx(`index`), then the label) and `"glass"` (one swatch per distinct drawn glass, as `glassLegend` gives, in first-use order), in one row in the order given, wrapping at the drawing's width. The SVG grows by its lines, to a whole px. Not drawn below a width of 630, with no room kept. Default none. */
  key?: (PlotKeyEntry | "glass")[] | "glass";
  /** The window in mm the drawing shows, `{ x: [zlo, zhi], y: [ylo, yhi] }`: fitted into the geometry band (inside the pads, below the label room, above the scale bar) at one scale on both axes and centred; geometry beyond it is clipped, text keeps its px size, and the scale bar takes a 1-2-5 mm length at the new scale. An axis that is not a finite increasing pair keeps the box's range, and a view with no valid axis is ignored. The size does not depend on it. `interact`'s `onview` sends it. */
  view?: PlotView;
}
export interface Layout3DProps {
  data?: object;
  /** Show 4 marginal rays + chief ray per field. Default true. */
  rays?: boolean;
  /** View angles in degrees. Default yaw -38, pitch 16 (Iso). */
  yaw?: number;
  pitch?: number;
  /** Zoom factor. Default 4.6. */
  scale?: number;
  width?: number;
  height?: number;
}
/** One spot series: dots in the panel's unit, one palette slot. Every dot is the same size; there is no color option (ADR-0001). */
export interface SpotSeries {
  /** [x, y] per ray, in `unit`, relative to the zero point named by `origin`. A null or non-finite point is skipped. */
  points: [number | null, number | null][];
  /** Palette slot: the series color follows idx(index). Default 0. */
  index?: number;
  /** Keys the series in the SVG: a dot in its color and this text, once per distinct label, below the captions, or in each panel's corner by `keyAt`. */
  label?: string;
}
/** One spot panel, usually one field. */
export interface SpotPanel {
  /** Drawn above the panel, e.g. "0.0°". */
  title?: string;
  series: SpotSeries[];
  /** Airy radius in the panel's unit, drawn as a circle when `showAiry` is not false. */
  airy?: number;
  /** A labelled circle about the origin, drawn like the Airy circle and counted in the box size. The caption line reads "<label> <radius> <unit>" when every panel has a circle and their radii (as printed) and labels agree, else the first circle's "<label>", and no line when that label is empty, blank or missing. A radius that is not finite and above 0 draws nothing. */
  circle?: { radius: number; label: string };
  /** Extra caption lines under the panel, after the RMS and GEO lines. */
  notes?: string[];
}
/** A zoomed and panned window, in data units: what `interact`'s `onview` sends and the renderers' `view` prop takes. A curve, ray fan, typed map or layout2D takes `{ x, y }` (either key optional on input; a map's in extent units; a layout's window is the geometry band, in mm); a spot or through-focus a square window `{ center, half }` shared by every panel. */
export type PlotView = { x?: [number, number]; y?: [number, number] };
export type SpotView = { center: [number, number]; half: number };
export type View = PlotView | SpotView;
/** Typed call: you give the panels. */
export interface SpotPanelsProps {
  /** Zoom window: one square window for every panel, replacing the common half-width and the centre. Ignored when not `{ center: [cx, cy], half }` with finite `half` above 0. */
  view?: SpotView;
  panels: SpotPanel[];
  /** Names the zero point in the caption. Default "chief ray". Used with reference "chief". */
  origin?: string;
  /** "centroid" recentres every panel on the centroid of its dots. Default "chief": dots stay as given, labelled with origin. */
  reference?: "chief" | "centroid";
  /** RMS and GEO radius lines under each panel. Default true. */
  showStats?: boolean;
  /** `false` draws no grid lines; the frame and centre cross stay. Default true: lines at the nice ticks strictly inside (-half, half) (the frame draws the edges), in --plot-grid, under the dots. */
  grid?: boolean;
  /** Draw each panel's Airy circle. Default true. */
  showAiry?: boolean;
  /** Box size rule. Default "common". */
  scale?: "common" | "auto";
  /** Box half-width in `unit`; overrides the automatic common size. */
  half?: number;
  /** Unit of the points, the radii and the half-width, e.g. "µm". */
  unit?: string;
  /** The SVG's aria-label. Default "Spot diagrams". */
  label?: string;
  /** Multiplies ADR-0003's text size for the panel side (and the gaps, line pitch, foot and caption width estimate around it). Default 1; a value that is not a finite number above 0 means 1. */
  textScale?: number;
  /** Where series labels are keyed: "below" the captions (default), or a corner of each panel (a box on --surface with that panel's labels; no rows reserved). */
  keyAt?: PlotKeyAt;
  /** Drawing width in px; a panel's side F solves `F + 2.4 * text(F) = (width - 22 * (panels - 1)) / panels` (more than 2.4 text units when the y labels are longer than three characters; less when `height` caps it), ADR-0003's frame (`textScale` multiplying the text). Without it, 150 px panels. */
  width?: number;
  /** Caps the figure's height in px: a side that would not leave room for the notes and caption shrinks, and a height still too small grows to fit. */
  height?: number;
  data?: never;
  colorBy?: never;
}
/** Sample call: the spots of the sample (or `data`), one color per wavelength or field. */
export interface SpotSampleProps {
  data?: object;
  /** Default "wavelength". */
  colorBy?: IndexKey;
  /** Box size rule. Default "common". */
  scale?: "common" | "auto";
  /** Box half-width in µm; overrides the automatic common size. */
  half?: number;
  /** `false` draws no grid lines; the frame and centre cross stay. Default true: lines at the nice ticks strictly inside (-half, half) (the frame draws the edges), in --plot-grid, under the dots. */
  grid?: boolean;
  /** Airy circle. Default true. */
  airy?: boolean;
  /** Names the zero point in the caption. Default "chief ray". Used with reference "chief". */
  origin?: string;
  /** "chief" keeps the dots as given, labelled with origin. Default "centroid": every panel is recentred on the centroid of its dots. */
  reference?: "chief" | "centroid";
  /** RMS and GEO radius lines under each panel. Default true. */
  showStats?: boolean;
  /** Draw each panel's Airy circle. Default true. */
  showAiry?: boolean;
  /** Multiplies ADR-0003's text size for the panel side (and the gaps, line pitch, foot and caption width estimate around it). Default 1; a value that is not a finite number above 0 means 1. */
  textScale?: number;
  /** Drawing width in px; a panel's side F solves `F + 2.4 * text(F) = (width - 22 * (panels - 1)) / panels` (more than 2.4 text units when the y labels are longer than three characters; less when `height` caps it), ADR-0003's frame (`textScale` multiplying the text). Without it, 150 px panels. */
  width?: number;
  /** Caps the figure's height in px: a side that would not leave room for the notes and caption shrinks, and a height still too small grows to fit. */
  height?: number;
  /** Zoom window: one square window for every panel, as `SpotPanelsProps.view`. */
  view?: SpotView;
  panels?: never;
}
export interface ThroughFocusProps {
  data?: object;
  /** Zoom window: one square window for every cell, as `SpotPanelsProps.view`. */
  view?: SpotView;
  /** Box half-width in the data's unit. */
  half?: number;
  /** The figure's width in px. A panel's side is ADR-0003's frame, solved from it; 92 px without it. */
  width?: number;
  /** `false` draws no grid lines in the cells. Default: `spot`'s grid, at the nice ticks strictly inside (-half, half), under the dots. */
  grid?: boolean;
}
export type SpotDiagramProps = SpotPanelsProps | SpotSampleProps;
export interface RayFanProps {
  data?: object;
  /** Zoom window in data units, replacing the drawn ranges of every panel; an absent key keeps that axis's range. */
  view?: PlotView;
  /** Transverse ray aberration (µm) or optical path difference (waves). Default "tra". */
  kind?: "tra" | "opd";
  /** Field indexes to show. Default all. */
  fields?: number[];
  /** Full scale, same unit as kind. Default: next round value above the largest value. */
  fullScale?: number;
  /** The figure's width in px, split per column (ADR-0003: each column's frame, text size and strokes follow curve's rule). Default: columns times (`panelWidth` + 58). */
  width?: number;
  /** The figure's height in px. Default 314 for the default shape, scaled with the width. */
  height?: number;
  panelWidth?: number;
  /** `true` keys each sample wavelength ("486.1 nm") below the fans, through `curve`'s key. Default no key. */
  key?: boolean;
  /** Where the `key` goes, as `curve`'s `keyAt`: "below" the fans (default) or a corner box in each panel. An unknown value throws curve's TypeError. */
  keyAt?: PlotKeyAt;
  /** `false` draws no grid lines; the tick labels, frame and zero axes stay. Default true. */
  grid?: boolean;
}
export interface Map2DProps {
  data?: object;
  /** Default "psf". */
  kind?: "psf" | "wavefront";
  /** Default "ember" for psf, "wave" for wavefront. */
  map?: "ember" | "wave" | "viridis" | "gray";
  /** PSF only. Default "linear" (log shows 4 decades). */
  scale?: "linear" | "log";
  /** PSF index in data.psf. Default 0. */
  index?: number;
  /** Canvas size in px. Default 320. */
  size?: number;
}
/** A grid drawn as a map: SVG in curve's frame with the grid as one nearest-neighbour `<image>`. Colors come from `map` read at `el`; there is no color option (ADR-0001). */
export interface Map2DGridProps {
  /** Zoom window in extent units, per axis; the image keeps its extent and the frame clips it. An invalid range (not finite, or lo >= hi) is ignored and keeps that axis's extent, as for a curve or spot. */
  view?: PlotView;
  /** Rows of cells, row 0 at the top. A cell that is not a finite number is masked: it draws no color, so the page's `--surface` shows. Plain arrays. With `polar`, `values[ring][spoke]` are polar samples instead. */
  values: number[][];
  /** Polar samples about the origin of `extent`: `radii` in extent units, `angles` in radians from +x, counter-clockwise (y up). `values[ring][spoke]` is the sample at `radii[ring]`, `angles[spoke]`. */
  polar?: { radii: number[]; angles: number[] };
  /** [x0, x1, y0, y1] in data units: the grid's outer edges. Px per unit are equal on x and y. */
  extent: [number, number, number, number];
  /** Axis labels and ticks. `range` is ignored: the extent sets it. */
  x?: CurveAxis;
  y?: CurveAxis;
  /** Colormap. Default "ember"; "wave" for a signed range. */
  map?: "ember" | "wave" | "viridis" | "gray";
  /** Default "linear" over [min, max]. "log" spans `decades` below the max, or exactly `range` when 0 < lo < hi. */
  scale?: "linear" | "log";
  /** Decades a log scale spans below the max. Default 4. Ignored when `range` is [lo, hi] with 0 < lo < hi: that range sets the span. */
  decades?: number;
  /** [lo, hi] of the color scale, in data units. Default: the range of the live cells (symmetric about 0 for "wave"). */
  range?: [number, number];
  /** A circle in extent units: cells outside it draw as `--surface` and a ring marks its edge. */
  aperture?: { x: number; y: number; r: number };
  /** The colorbar's axis: `label` and `unit` name the value; `ticks` apply. Default none drawn without it. */
  value?: CurveAxis;
  /** Grid lines drawn over the image (the frame's own lines are not drawn), per axis, in the map's grid tokens (`--map-grid-<map>`, minors `--map-grid-<map>-minor`). `major` is the target for the labelled nice ticks, about that many (at least 2; the 1-2-5 rule picks the step; the axis's own `ticks` win); `minor` is the lines evenly spaced inside each interval (at most 20, else a `map2D: grid` TypeError); `false` for none. `true` draws the default majors and no minors on both axes; in an object, an axis left out (or `null`) has them and `false` draws no lines on that axis. `false`, `null` or no `grid` draws no lines at all, over or under the image; the tick labels stay. Default: no grid. */
  grid?: boolean | null | { x?: false | null | { major?: number; minor?: number | false }; y?: false | null | { major?: number; minor?: number | false } };
  /** Element whose tokens color the map. Default the document root. */
  el?: Element;
  /** Drawing width in px. The plot frame's width F solves `F + m * t(F) = width`, with t the text size (9 px below F = 162, `F / 18` to 234, then `13 * (F / 234)^(1/3)`) and m the margins in text units (ADR-0003). Default 460. */
  width?: number;
  /** Drawing height in px. Default `round(width * 360 / 460)`. */
  height?: number;
  /** Accessible name of the svg. Default "Map". */
  label?: string;
}
/** One curve. Every role draws the same stroke, 1 px up to a 234 px frame and `sqrt(F / 234)` px above it (F is the plot frame's width, ADR-0003); there is no color, width or dash option (ADR-0001). */
export interface CurveSeries {
  /** [x, y] in data units. Points outside the axis ranges are clipped by the plot area. */
  points: [number, number][];
  /** Palette slot: the series color follows idx(index). Default 0. */
  index?: number;
  /** "tangential" is solid, "sagittal" dashed, "reference" a dotted ink line, "limit" a dash-dot ink line. The last two ignore `index`. Default solid, like tangential. */
  role?: "tangential" | "sagittal" | "reference" | "limit";
  /** Named in the key: one entry per distinct label, from its first use's role and index. A series without one has no key entry. */
  label?: string;
}
/** A key entry: a line swatch in the role's colour (`index`'s palette slot, or `--ink` for `reference` and `limit`) and `role`'s dash, then the label (ADR-0001: never a color). */
export interface PlotKeyEntry { label: string; index?: number; role?: CurveSeries["role"] }
/** Where a key goes: under the x label (the SVG grows by its rows, or with a `height` the frame gives them up) or in a plot corner, on a `--surface` box that never resizes the frame. */
export type PlotKeyAt = "below" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export interface CurveAxis {
  /** Drawn as "label, unit". */
  label?: string;
  unit?: string;
  /** [lo, hi] in data units. Default: the nice range of the data. */
  range?: [number, number];
  /** Tick positions. Default: nice ticks for the range. */
  ticks?: number[];
}
/** A series in a panel: a null coordinate breaks the line, and the next live point starts a new run. */
export interface CurvePanelSeries extends Omit<CurveSeries, "points"> {
  points: [number | null, number | null][];
}
/** One panel of a curve grid: a title and its series. */
export interface CurvePanel {
  /** Drawn above the panel. */
  title?: string;
  series: CurvePanelSeries[];
}
/** A y limit: a number draws a line across the plot, a pair [lo, hi] a band, in the `limit` style (ADR-0001: a role's style, never a color). */
export interface PlotLimitY { y: number | [number, number]; x?: never; label?: string }
/** An x limit, as PlotLimitY on the x axis. `bars` has no x limits: its x axis is categories. */
export interface PlotLimitX { x: number | [number, number]; y?: never; label?: string }
/** A limit line or band on a curve: exactly one of x and y. A bad limit throws a TypeError at run time. */
export type PlotLimit = PlotLimitX | PlotLimitY;
/** Typed call: you give the series and axes. */
export interface CurveSeriesProps {
  series: CurveSeries[];
  x?: CurveAxis;
  y?: CurveAxis;
  /** Limit lines and bands; an auto range contains them. */
  limits?: PlotLimit[];
  /** The key's entries, replacing those the series labels give; `[]` draws none. */
  key?: PlotKeyEntry[];
  /** Default "below". */
  keyAt?: PlotKeyAt;
  /** `false` draws no grid lines; the tick labels, frame and zero axes stay. Default true. */
  grid?: boolean;
  /** Drawing width in px. The plot frame's width F solves `F + m * t(F) = width`, with t the text size (9 px below F = 162, `F / 18` to 234, then `13 * (F / 234)^(1/3)`) and m the margins in text units (ADR-0003). Default 460. */
  width?: number;
  height?: number;
  kind?: never;
  panels?: never;
}
/** Panels call: a grid of plots on one shared scale, the axis labels drawn once. */
export interface CurvePanelsProps {
  panels: CurvePanel[];
  /** Columns of the grid. Default: one row. */
  columns?: number;
  x?: CurveAxis;
  y?: CurveAxis;
  /** Limit lines and bands, drawn in every panel. */
  limits?: PlotLimit[];
  /** The key's entries, replacing those the series labels give: one key for the figure below, or one per panel in a corner. */
  key?: PlotKeyEntry[];
  /** Default "below". */
  keyAt?: PlotKeyAt;
  /** `false` draws no grid lines; the tick labels, frame and zero axes stay. Default true. */
  grid?: boolean;
  /** Drawing width in px. The plot frame's width F solves `F + m * t(F) = width`, with t the text size (9 px below F = 162, `F / 18` to 234, then `13 * (F / 234)^(1/3)`) and m the margins in text units (ADR-0003). Default 460. */
  width?: number;
  height?: number;
  kind?: never;
  series?: never;
}
/** Kind call: the analysis kind of the sample (or `data`), drawn through the typed path. */
export interface CurveKindProps {
  data?: object;
  kind: "mtf" | "fieldCurvature" | "distortion" | "chromaticFocus";
  /** Drawing width in px, as for a typed call (ADR-0003). Default 460. */
  width?: number;
  height?: number;
  /** `false` draws no grid lines; the tick labels, frame and zero axes stay. Default true. */
  grid?: boolean;
  series?: never;
  panels?: never;
  limits?: never;
}
/** `view` overrides the drawn x and y ranges of every panel (an absent key keeps that axis's range); `interact`'s `onview` sends it. */
export type CurvePlotProps = (CurveSeriesProps | CurvePanelsProps | CurveKindProps) & { view?: PlotView };
/** One bar series: a value per category, one palette slot. There is no color option (ADR-0001). */
export interface BarSeries {
  /** One value per category, in `y` units; the bar rises from 0, so a negative value hangs below it. A null (or any value that is not a finite number) is a gap: no bar, no share of the total or the range. A series may be shorter than `categories`. */
  values: (number | null)[];
  /** Palette slot: the series color follows idx(index). A non-negative integer; default 0. */
  index?: number;
  /** Named in the key row under the plot; a series without one has no key. */
  label?: string;
}
/** Signed grouped bars in curve's frame: a group per category, a bar per series. */
export interface BarPlotProps {
  categories: string[];
  series: BarSeries[];
  /** Appends a group of per-series sums after a gap, labelled with this text. Default none. */
  total?: string;
  /** The value axis: `label`, `unit` and `range` apply; `ticks` do too. Default: the nice range of the values, the limits and 0. */
  y?: CurveAxis;
  /** y limits only: a category axis has no x value to draw at (an x limit throws). */
  limits?: PlotLimitY[];
  /** `false` draws no grid lines; the tick labels, frame, zero line and category dividers stay. Default true. */
  grid?: boolean;
  /** Drawing width in px. The plot frame's width F solves `F + m * t(F) = width`, with t the text size (9 px below F = 162, `F / 18` to 234, then `13 * (F / 234)^(1/3)`) and m the margins in text units (ADR-0003). Default 460. */
  width?: number;
  /** Drawing height in px. Default `round(width * 260 / 460)`. */
  height?: number;
}
export interface ELEO {
  /** The sample system, once "@eleoptics/plots/sample" is imported; null before. */
  sample: object | null;
  /** Make `sample` the default data for every renderer. "@eleoptics/plots/sample" calls this. */
  useSample(sample: object): void;
  /** Read a token from CSS: css(el, "accent"). */
  css(el: Element | null, name: string): string;
  maps: { viridis: string[]; gray: string[] };
  /** Number with a true minus sign and fixed decimals; "—" for missing. */
  fmt(v: number, decimals?: number): string;
  /** CSS gradient for a colorbar: token maps follow the theme. */
  gradient(map: "ember" | "wave" | "viridis" | "gray", direction?: string): string;
  layout2D(props?: Layout2DProps): string;
  /** The box that frames every layout given (eleoptics.com's bounds()): pass it as `box` to draw them at one scale. */
  layoutBounds(layouts: RecordedLayout[]): LayoutBox;
  /** Legend keys for a layout's named glasses: one swatch per distinct drawn glass, in first-use order, filled as layout2D fills it. "" when none. Takes what Layout2DProps.data takes; throws a named error without a recorded layout (a system reads `layout`, else `layoutWl`). */
  glassLegend(data: RecordedLayout | LayoutSystem): string;
  layout3D(canvas: HTMLCanvasElement, props?: Layout3DProps): void;
  spot(props?: SpotDiagramProps): string;
  throughFocus(props?: ThroughFocusProps): string;
  rayFan(props?: RayFanProps): string;
  /** A typed grid as SVG markup. */
  map2D(props: Map2DGridProps): string;
  /** The sample's PSF or wavefront drawn on a canvas. */
  map2D(canvas: HTMLCanvasElement, props?: Map2DProps): { lo: number; hi: number };
  curve(props: CurvePlotProps): string;
  bars(props: BarPlotProps): string;
  /** One icon as inline SVG. Default style "line", size 16. */
  icon(name: string, props?: { style?: "line" | "glass" | "blueprint"; size?: number; label?: string }): string;
  /** Every icon name and title, by set. */
  icons: { optical: { name: string; title: string }[]; interface: { name: string; title: string }[] };
  /** Legend items for a PlotLegend. n above 8 adds hollow-marker keys. With a sample loaded, field/wavelength keys carry its values (n defaults to its count); without one they draw n index keys (F1.., λ1..) without values, and none without n. `values` (deg or nm) replaces the sample's, one key per value, n defaulting to its length; a non-finite entry draws the index key alone. ts and rays are fixed either way. */
  legend(kind: "field" | "wavelength" | "ts" | "rays", n?: number, values?: readonly number[]): string;
  /** Draw at the container's content width, a fractional px value (a CSS transform on an ancestor scales the measured box, since getBoundingClientRect includes transforms): `el.getBoundingClientRect().width` minus its computed left and right padding and border widths (content box), rounded to 2 decimals. Calls `draw(width)` now (not while the width is 0: it draws once the element gets a width), then again when the width changes (at most once per animation frame, only when that width changed, never for a height-only change or a width of 0 or less), through one shared ResizeObserver. `draw` writes the markup, e.g. `fit(body, (w) => { body.innerHTML = curve({ ...d, width: w }); })`. Returns `stop()`. */
  fit(el: Element, draw: (width: number) => void): () => void;
}
import type * as Physics from './physics.js';
export * from './physics.js';

interface ScaleRule {
  frameText: typeof frameText; frameWeight: typeof frameWeight; frameOf: typeof frameOf; layoutText: typeof layoutText; layoutWeight: typeof layoutWeight;
  TEXT_MIN: typeof TEXT_MIN; TEXT_MAX: typeof TEXT_MAX; F_LO: typeof F_LO; F_HI: typeof F_HI; W_LO: typeof W_LO; W_HI: typeof W_HI;
  PLOT_SIZES: typeof PLOT_SIZES; CURVE_MARGINS: typeof CURVE_MARGINS;
  minWidth: typeof minWidth;
  interact: typeof interact;
  readout: typeof readout;
}
declare const ELEO: ELEO & typeof Physics & ScaleRule;
export default ELEO;
export declare const layout2D: ELEO['layout2D'], layout3D: ELEO['layout3D'], spot: ELEO['spot'],
  throughFocus: ELEO['throughFocus'], rayFan: ELEO['rayFan'], map2D: ELEO['map2D'], curve: ELEO['curve'], bars: ELEO['bars'],
  legend: ELEO['legend'], icon: ELEO['icon'], icons: ELEO['icons'], gradient: ELEO['gradient'], fmt: ELEO['fmt'],
  css: ELEO['css'], maps: ELEO['maps'], useSample: ELEO['useSample'], layoutBounds: ELEO['layoutBounds'],
  glassLegend: ELEO['glassLegend'], fit: ELEO['fit'];

/* The plot scale rule of ADR-0003 (packages/plots/src/scale.js). Sizes are px. */
/** Text size for a plot frame F px wide: 9 below 162, F / 18 to 234 (13), then 13 * (F / 234)^(1/3). */
export declare function frameText(F: number): number;
/** Weight of series strokes, rays and dots for a frame F px wide: 1 up to 234, then sqrt(F / 234). */
export declare function frameWeight(F: number): number;
/** The frame width F that solves F + m * frameText(F) = W, for a drawing W px wide and horizontal margins m in text units; at least 1. */
export declare function frameOf(W: number, m: number): number;
/** layout2D text size for a drawing W px wide: W / 70 from 630 to 910, then 13 * sqrt(W / 910); null where labels and the scale bar are hidden (W / 70 under 9). */
export declare function layoutText(W: number): number | null;
/** layout2D ray stroke weight for a drawing W px wide: 1 up to 910, then sqrt(W / 910). */
export declare function layoutWeight(W: number): number;
/** The rule's breakpoints and text limits, in px. */
export declare const TEXT_MIN: 9, TEXT_MAX: 13, F_LO: 162, F_HI: 234, W_LO: 630, W_HI: 910;
/** ADR-0003's margins of the curve family (curve, rayFan, bars, map2D), in text units: `L` left, `T` top, `B` bottom (the right one follows the ticks). Multiply by `frameText(F)` for px. */
export declare const CURVE_MARGINS: Readonly<{ L: 4.6; T: 2.6; B: 3.6 }>;
/** One renderer's row of PLOT_SIZES, in px. */
export interface PlotSize {
  /** The default drawing width of one panel (what the renderer draws without `width`). */
  width: number;
  /** Height over width of that default drawing, or null where the height follows the content. */
  aspect: number | null;
  /** The narrowest width of a one-panel figure: its plot frame is F_LO wide, its text 9 px. */
  minWidth: number;
  /** The width each further panel adds at that floor (0 for a single plot): a figure of n panels needs `minWidth + (n - 1) * panelStep`. */
  panelStep: number;
}
/** The size table of ADR-0003, computed from the scale rule and the renderers' margins. The curve family's figures assume the shortest right margin (1.2 text units); for a call's own labels, colorbar and panel count use `minWidth(name, props)`. */
export declare const PLOT_SIZES: {
  curve: PlotSize; rayFan: PlotSize; bars: PlotSize; map2D: PlotSize; spot: PlotSize; throughFocus: PlotSize; layout2D: PlotSize;
};
/** The narrowest drawing width of a call, in px: its plot frame `F_LO` wide and its text `TEXT_MIN` px, with the margins the renderer draws for these props (a curve's x tick labels, map2D's colorbar and x ticks) and the panel count of `columns`, `panels`, the sample's fields or defocus steps. `props` are the ones you pass the renderer; without them it is `PLOT_SIZES[name]`'s one-panel figure. Throws a `TypeError` for an unknown renderer name. */
export declare function minWidth(name: keyof typeof PLOT_SIZES, props?: object): number;

/* Pointer interaction (packages/plots/src/interact.js). */
/** What the pointer is on: a drawn point of a mark, a bar, a map sample or the spot on the line between two consecutive points, in data units. Which keys are present depends on the plot: a curve, spot or bar has `series`; a bar adds `category`; a typed map has `row` and `column` (or `ring` and `spoke`); a layout2D ray run has `field`, `ray` and `status` and no `series`. */
export interface HoverEvent {
  /** The data coordinates of the hovered point, or of the interpolated spot on the segment (the pointer projected onto it and clamped to it, so at a segment's end they can equal a data point). */
  x: number;
  y: number;
  /** The mark's identity from the drawing's `data-series`, `data-label` and `data-role`. `index` is the series' position in the `series` array (in its panel, with `panels`), not its `index` palette slot: two series can share a slot. `label` and `role` are absent where the series has none. */
  series?: { index: number; label?: string; role?: string };
  /** The panel index from `data-panel`. Absent on a single curve plot (no `panels`); a spot drawing always sends it. */
  panel?: number;
  /** A bar's category index (`data-category`; the total's group). Present only on a `bars` hover. */
  category?: number;
  /** A bar's category text as drawn on the axis (`data-category-label`; the total's label for the total's group). Present only on a `bars` hover, and `readout` prints it in place of `x`; where it is empty, `readout` prints the category index (`x`) formatted by `x`'s spec. */
  categoryLabel?: string;
  /** A typed grid `map2D` sample: its row (top-down, as `values[row][column]`) and column. Present only on a grid map hover. */
  row?: number;
  column?: number;
  /** A typed polar `map2D` sample: indices into `radii` and `angles`. Present only on a polar map hover. */
  ring?: number;
  spoke?: number;
  /** The sample's value, `opts.values[row][column]` (`[ring][spoke]` for polar). Present only on a map hover given `opts.values`; `null` for a masked sample (a cell that is not a finite number). */
  value?: number | null;
  /** A layout2D ray run: its field index (`data-field`), its ray index (`data-ray`) and its status (`data-status`, absent where the run has none). */
  field?: number;
  ray?: number;
  status?: string;
  /** A layout2D glass element, hovered where no ray run is in reach (no `series`, `field` or `ray`; `x`, `y` are the pointer in mm). `element` is 1-based over the glass polygons and `glass` its glass name; `nd`, `vd` and `f` (thick-lens focal length, mm) are present only for a named glass with finite values; `r1`, `r2` (vertex radii, mm; `Infinity` for a flat surface), `ct` (vertex thickness) and `diameter` are in mm. `readout` prints them on five lines. */
  element?: number;
  glass?: string;
  nd?: number;
  vd?: number;
  r1?: number;
  r2?: number;
  ct?: number;
  diameter?: number;
  f?: number;
  /** `true` when the pointer did not snap to a point (not within 6 px of one): `x` and `y` are then the pointer projected onto the straight line joining two points, clamped to it (within 24 px of it), so at a segment's end they can equal a data point. Absent when the event is a data point itself. */
  interpolated?: true;
  /** The data indices `[i, i + 1]` of the two joined points: the drawn indices among the mark's finite points, in order, plus the mark's `data-from` (0 when absent). Present only with `interpolated`. */
  segment?: [number, number];
}
/** What a click selected, named by the clicked mark's own identity: a curve, spot or bar names its `series` (with `panel`, and a bar its `category`), a layout2D surface its `surface` (the surface index, `data-surface`), a layout2D ray run its `field` only. eleo-ui does nothing else with it. */
export interface SelectEvent {
  series?: { index: number; label?: string; role?: string };
  panel?: number;
  category?: number;
  surface?: number;
  field?: number;
}
export interface InteractOptions {
  /** Called with the hovered point, or the interpolated spot on the line between two points (see `HoverEvent.interpolated`), nearest the pointer, or `null` when the pointer leaves it or the host. Repeats of the same point are not re-sent. */
  onhover?: (event: HoverEvent | null) => void;
  /** Called once per click on a mark, with the mark's identity (see `SelectEvent`). A click on no mark sends nothing. */
  onselect?: (event: SelectEvent) => void;
  /** Values of a typed `map2D`, `values[row][column]` (`[ring][spoke]` for polar), read into `HoverEvent.value`. */
  values?: number[][];
  /** How the tooltip's `readout` writes each axis (unit, digits). Default: no units, `readout`'s default digits. */
  axes?: { x?: ReadoutAxis; y?: ReadoutAxis; value?: ReadoutAxis };
  /** Draw a dot on the hovered point and drop lines to both axes in an overlay on the host. Default `true`. */
  marks?: boolean;
  /** Show the readout in a tooltip near the pointer. Default `true`. While marks or the tooltip are on, the host carries the class `eleo-hover-host`. */
  tooltip?: boolean;
  /** Turns on zoom and pan. A wheel zooms about the pointer, a drag pans, a double-click resets; each calls `onview` with the new view (`View`: `{ x, y }` for a curve, ray fan, typed map or layout2D, `{ center, half }` for a spot or through-focus; reset sends `null`) and draws nothing: redraw with it as the renderer's `view`, and with none for `null`. The current ranges are read from the drawn markup each time, so the caller's view is the only state. A drag is not also a click (`onselect`). */
  onview?: (view: View | null) => void;
}
/** `interact`'s stop function: removes the listeners. */
export interface InteractStop {
  (): void;
  /** Calls `onview(null)`, as a double-click does. Does nothing without `onview` or after stop. */
  reset(): void;
}
/** Listen for the pointer on `el`, the element holding the drawn SVG. The listeners sit on `el`, so a redraw that replaces its markup keeps them. Client-only. Returns `stop()`, which removes them, and has a `reset()` method. */
export declare function interact(el: Element, opts?: InteractOptions): InteractStop;
/** How `readout` writes one axis's value. */
export interface ReadoutAxis {
  /** Appended after the value, e.g. "mm". Default none. */
  unit?: string;
  /** Decimals. Default: at most 2, trailing zeros dropped. */
  digits?: number;
}
/** The text of a hover event, `<label> · <x>, <y>[ = <value>]`, each number followed by its axis's unit (no label and dot without a series label; ` = <value>` only when the event's `value` is not null, written with `axes.value`); "" for `null`. */
export declare function readout(event: HoverEvent | null, axes?: { x?: ReadoutAxis; y?: ReadoutAxis; value?: ReadoutAxis }): string;
