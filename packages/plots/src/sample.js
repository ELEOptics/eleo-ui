// The sample system every preview draws: importing this module makes it the renderers' default data.
import ELEO from './renderers.js';
import SAMPLE from './sample.json' with { type: 'json' };

ELEO.useSample(SAMPLE);

export default SAMPLE;
