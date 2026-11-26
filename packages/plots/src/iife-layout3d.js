// Classic-script layout3D on its own (bundles three.js): layout3D on window.ELEO, beside eleo-plots.js.
// It adds to the existing ELEO object in place (like eleo-plots.js), so a setter on window.ELEO does not see a second assignment.
import { layout3D } from './layout3d.js';
if (window.ELEO) window.ELEO.layout3D = layout3D;
else window.ELEO = { layout3D: layout3D };
