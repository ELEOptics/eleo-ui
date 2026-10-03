// Classic-script sample: load after eleo-plots.js; it registers the sample on that copy of ELEO.
import SAMPLE from './sample.json' with { type: 'json' };

if (!window.ELEO || !window.ELEO.useSample) throw new Error('Load eleo-plots.js before eleo-plots-sample.js.');
window.ELEO.useSample(SAMPLE);
