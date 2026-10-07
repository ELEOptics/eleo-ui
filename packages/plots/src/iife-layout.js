// Classic-script lens layouts on their own: layout2D and layoutBounds on window.ELEO, with no sample.
import { layout2D, layoutBounds } from './layout2d.js';
window.ELEO = Object.assign(window.ELEO || {}, { layout2D: layout2D, layoutBounds: layoutBounds });
