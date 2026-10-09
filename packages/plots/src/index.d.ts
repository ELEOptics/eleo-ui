/* @eleoptics/plots. All SVG output reads colors from tokens.css
   variables; canvas renderers read them at draw time, so call them again after a theme or palette change. */

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
}
/** A layout as eleoptics.com's scripts/layout.py records it, in mm. */
export interface RecordedLayout {
  surfaces: RecordedSurface[];
  /** rays[field][ray] is a polyline of [z, y] points. */
  rays: [number, number][][][];
  /** One ray index per fan; without it, the chief is the middle ray, floor(n / 2). */
  chief?: number[];
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
  /** viewBox width in px; the drawing is always true scale. Default 1000. */
  width?: number;
  /** One text per fan, drawn 6 px past the image plane, beside the end of that fan's chief ray, with room kept for them (an empty fan gets none). A null or undefined entry skips that fan; more labels than fans throws. Default none. */
  labels?: (string | null | undefined)[];
  /** Draw the STO and IMA labels. Default true. */
  marks?: boolean;
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
export interface SpotDiagramProps {
  data?: object;
  /** Default "wavelength". */
  colorBy?: IndexKey;
  /** Box size rule. Default "common". */
  scale?: "common" | "auto";
  /** Box half-width in µm; overrides the automatic common size. */
  half?: number;
  /** Airy circle. Default true. */
  airy?: boolean;
}
export interface RayFanProps {
  data?: object;
  /** Transverse ray aberration (µm) or optical path difference (waves). Default "tra". */
  kind?: "tra" | "opd";
  /** Field indexes to show. Default all. */
  fields?: number[];
  /** Full scale, same unit as kind. Default: next round value above the largest value. */
  fullScale?: number;
  panelWidth?: number;
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
/** One curve. Every role draws a 1 px stroke; there is no color, width or dash option (ADR-0001). */
export interface CurveSeries {
  /** [x, y] in data units. Points outside the axis ranges are clipped by the plot area. */
  points: [number, number][];
  /** Palette slot: the series color follows idx(index). Default 0. */
  index?: number;
  /** "tangential" is solid, "sagittal" dashed, "reference" a dotted ink line. Default solid, like tangential. */
  role?: "tangential" | "sagittal" | "reference";
}
export interface CurveAxis {
  /** Drawn as "label, unit". */
  label?: string;
  unit?: string;
  /** [lo, hi] in data units. Default: the nice range of the data. */
  range?: [number, number];
  /** Tick positions. Default: nice ticks for the range. */
  ticks?: number[];
}
/** Typed call: you give the series and axes. */
export interface CurveSeriesProps {
  series: CurveSeries[];
  x?: CurveAxis;
  y?: CurveAxis;
  width?: number;
  height?: number;
  kind?: never;
}
/** Kind call: the analysis kind of the sample (or `data`), drawn through the typed path. */
export interface CurveKindProps {
  data?: object;
  kind: "mtf" | "fieldCurvature" | "distortion" | "chromaticFocus";
  width?: number;
  height?: number;
  series?: never;
}
export type CurvePlotProps = CurveSeriesProps | CurveKindProps;
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
  throughFocus(props?: { data?: object; half?: number }): string;
  rayFan(props?: RayFanProps): string;
  map2D(canvas: HTMLCanvasElement, props?: Map2DProps): { lo: number; hi: number };
  curve(props: CurvePlotProps): string;
  /** One icon as inline SVG. Default style "line", size 16. */
  icon(name: string, props?: { style?: "line" | "glass" | "blueprint"; size?: number; label?: string }): string;
  /** Every icon name and title, by set. */
  icons: { optical: { name: string; title: string }[]; interface: { name: string; title: string }[] };
  /** Legend items for a PlotLegend. n above 8 adds hollow-marker keys. With a sample loaded, field/wavelength keys carry its values (n defaults to its count); without one they draw n index keys (F1.., λ1..) without values, and none without n. ts and rays are fixed either way. */
  legend(kind: "field" | "wavelength" | "ts" | "rays", n?: number): string;
}
import type * as Physics from './physics.js';
export * from './physics.js';

declare const ELEO: ELEO & typeof Physics;
export default ELEO;
export declare const layout2D: ELEO['layout2D'], layout3D: ELEO['layout3D'], spot: ELEO['spot'],
  throughFocus: ELEO['throughFocus'], rayFan: ELEO['rayFan'], map2D: ELEO['map2D'], curve: ELEO['curve'],
  legend: ELEO['legend'], icon: ELEO['icon'], icons: ELEO['icons'], gradient: ELEO['gradient'], fmt: ELEO['fmt'],
  css: ELEO['css'], maps: ELEO['maps'], useSample: ELEO['useSample'], layoutBounds: ELEO['layoutBounds'],
  glassLegend: ELEO['glassLegend'];
