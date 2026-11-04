// Classic-script lens layouts on their own: layout2D, layoutBounds, glassLegend and fit on window.ELEO, with no sample.
import { layout2D, layoutBounds } from './layout2d.js';
import { glassLegend } from './glass.js';
import { fit } from './fit.js';
window.ELEO = Object.assign(window.ELEO || {}, { layout2D: layout2D, layoutBounds: layoutBounds, glassLegend: glassLegend, fit: fit });
