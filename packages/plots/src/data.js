// The sample state, shared by every renderer. Sample data is opt-in (import "@eleoptics/plots/sample"),
// so apps that draw their own systems don't ship the 190 KB demo trace.
export var state = { sample: null };
export function data(o) {
  var D = o.data || state.sample;
  if (!D) throw new Error('ELEO: pass { data }, or import "@eleoptics/plots/sample" to draw the sample achromat.');
  return D;
}
export function useSample(sample) { state.sample = sample; }
