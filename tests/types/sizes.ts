// minWidth(name, props) is typed on the module and on ELEO: a renderer name and its props give a width in px; an unknown name does not compile (#610, plan 603).
// oracle: closed-form ADR-0003 (as tests/unit/scale.test.js::minWidth gives the floor frame (#587)): minWidth is F_LO + TEXT_MIN * (L + R) + (panels - 1) * panelStep
import ELEO, { minWidth, curve } from '../../packages/plots/src/index';
import type { CurvePlotProps } from '../../packages/plots/src/index';

const props: CurvePlotProps = { series: [{ points: [[0, 1], [1, 2]] }], x: { label: 'x' }, y: { label: 'y' } };
const a: number = minWidth('curve', props);
const b: number = ELEO.minWidth('bars');
const html: string = curve({ ...props, width: minWidth('curve', props) });

// @ts-expect-error not a renderer
minWidth('pie');
// @ts-expect-error the name is required
minWidth();
export { a, b, html };
