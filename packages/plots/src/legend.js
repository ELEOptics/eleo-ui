import { idx } from "./common.js";
import { state } from "./data.js";
import { fmt } from "./color.js";

export function legend(kind, n) {
  var D = state.sample, out = [], F = D ? D.fields : [], W = D ? D.wl : [];
  if (kind === "field") for (var i = 0; i < (n || F.length); i++) out.push('<span class="eleo-key' + (i >= 8 ? " eleo-key--hollow" : "") + '" style="--c:' + idx(i) + '">F' + (i + 1) + (i < F.length ? " " + fmt(F[i], 1) + "°" : "") + "</span>");
  else if (kind === "wavelength") for (var j = 0; j < (n || W.length); j++) out.push('<span class="eleo-key' + (j >= 8 ? " eleo-key--hollow" : "") + '" style="--c:' + idx(j) + '">λ' + (j + 1) + (j < W.length ? " " + W[j].toFixed(1) + " nm" : "") + "</span>");
  else if (kind === "ts") out.push('<span class="eleo-key">T tangential</span><span class="eleo-key eleo-key--dash">S sagittal</span><span class="eleo-key eleo-key--dot">Diffraction limit</span>');
  else if (kind === "rays") out.push('<span class="eleo-key">Marginal ray</span><span class="eleo-key eleo-key--dash">Chief ray</span>');
  return out.join("");
}

