// standalone(svg, { fonts }) resolves a string and png(svg, { scale, fonts }) a Blob, on the module and on ELEO; a non-SVG element, a string scale and a bad fonts do not compile (#1081, plan 1076).
// oracle: spec plan 1076 (#1081 Behaviour: the two signatures)
import ELEO, { standalone, png } from '../../packages/plots/src/index';

declare const svg: SVGSVGElement;
async function run() {
  const a: string = await standalone(svg);
  const b: string = await standalone(svg, { fonts: false });
  const c: Blob = await png(svg);
  const d: Blob = await png(svg, { scale: 2, fonts: true });
  const e: string = await ELEO.standalone(svg, {});
  const f: Blob = await ELEO.png(svg, { scale: 2 });
  return [a, b, c, d, e, f];
}

// @ts-expect-error an HTML element is not an SVG element
standalone(document.createElement('div'));
// @ts-expect-error scale is a number
png(svg, { scale: '2' });
// @ts-expect-error fonts is a boolean
standalone(svg, { fonts: 'no' });
// @ts-expect-error the svg is required
png();
export { run };
