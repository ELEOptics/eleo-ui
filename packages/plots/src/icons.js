var OPT = [
["lens", "Positive lens", [["g","p","M10.5 3H13.5Q17.5 12 13.5 21H10.5Q6.5 12 10.5 3Z"],["ax","p","M2 12H22"]]],
["lens-negative", "Negative lens", [["g","p","M7.5 3H16.5Q12 12 16.5 21H7.5Q12 12 7.5 3Z"],["ax","p","M2 12H22"]]],
["doublet", "Cemented doublet", [["g","p","M8.5 3H11Q14 12 11 21H8.5Q4.5 12 8.5 3Z"],["f","p","M11 3H17Q15.5 12 17 21H11Q14 12 11 3Z"],["ax","p","M2 12H22"]]],
["mirror", "Mirror", [["s","p","M12 3V21"],["s","p","M12 5L14 3M12 9L15 6M12 13L15 10M12 17L15 14M12 21L15 18"],["lb","p","M3 6L12 12L3 18"]]],
["stop", "Aperture stop", [["s","p","M12 3V9.5M12 14.5V21M9.5 3H14.5M9.5 21H14.5"],["ax","p","M2 12H22"]]],
["prism", "Prism", [["g","p","M12 4L20.5 19H3.5Z"],["lb","p","M2 14L8.2 12.4L15.8 13.4L22 16.5"]]],
["grating", "Grating", [["s","p","M7 3V21M7 5H9M7 9H9M7 13H9M7 17H9M7 21H9"],["lb","p","M2 12H7"],["s","p","M10.5 12H22M10.5 12L21 6.5M10.5 12L21 17.5"]]],
["splitter", "Beam splitter", [["g","r",[6,6,12,12,1]],["s","p","M6 18L18 6"],["lb","p","M2 12H22M12 12V2"]]],
["fiber", "Fiber", [["s","p","M3 18C9 18 9.5 9 15 9"],["g","r",[15,7,5,4,1]],["lb","p","M20 9H22.5"]]],
["source", "Point source", [["lp","c",[5,12,2]],["s","p","M8.5 12H21M8.5 10.6L20.5 5M8.5 13.4L20.5 19"]]],
["collimated", "Collimated beam", [["lb","p","M3 7H21M3 12H21M3 17H21"],["rf","p","M9 4V20M15 4V20"]]],
["wavelength", "Wavelength", [["s","p","M2 12C3.5 7 5.5 7 7 12S10.5 17 12 12 15.5 7 17 12 20.5 17 22 12"],["s","p","M7 3.5V5.5M17 3.5V5.5M7 4.5H17"]]],
["detector", "Detector", [["s","r",[5,4,14,16,1.5]],["s","p","M5 9.33H19M5 14.67H19M9.67 4V20M14.33 4V20"]]],
["laser", "Laser", [["s","r",[2.5,8.5,10,7,1.5]],["s","p","M5.5 8.5V15.5"],["lb","p","M12.5 12H22"]]],
["layout", "Layout", [["g","p","M6.5 4H9.5Q12 12 9.5 20H6.5Q4 12 6.5 4Z"],["s","p","M2 7H10.2L20 12M2 17H10.2L20 12M20.5 7V17"]]],
["view-3d", "3D view", [["s","p","M12 3L20 7.5V16.5L12 21L4 16.5V7.5ZM4 7.5L12 12L20 7.5M12 12V21"]]],
["spot","Spot diagram",[["d","c",[12,21,0.75]],["d","c",[12.0,20.28,0.75]],["d","c",[12.0,18.12,0.75]],["d","c",[12.83,18.6,0.75]],["d","c",[12.83,19.56,0.75]],["d","c",[11.17,19.56,0.75]],["d","c",[11.17,18.6,0.75]],["d","c",[12.0,14.52,0.75]],["d","c",[13.39,15.03,0.75]],["d","c",[14.13,16.3,0.75]],["d","c",[13.87,17.76,0.75]],["d","c",[10.13,17.76,0.75]],["d","c",[9.87,16.3,0.75]],["d","c",[10.61,15.03,0.75]],["d","c",[12.0,9.48,0.75]],["d","c",[13.92,9.99,0.75]],["d","c",[15.33,11.4,0.75]],["d","c",[15.84,13.32,0.75]],["d","c",[15.33,15.24,0.75]],["d","c",[12.0,17.16,0.75]],["d","c",[8.67,15.24,0.75]],["d","c",[8.16,13.32,0.75]],["d","c",[8.67,11.4,0.75]],["d","c",[10.08,9.99,0.75]],["d","c",[12.0,3.0,0.75]],["d","c",[14.44,3.52,0.75]],["d","c",[16.46,4.99,0.75]],["d","c",[17.71,7.15,0.75]],["d","c",[17.97,9.63,0.75]],["d","c",[17.2,12.0,0.75]],["d","c",[15.53,13.85,0.75]],["d","c",[8.47,13.85,0.75]],["d","c",[6.8,12.0,0.75]],["d","c",[6.03,9.63,0.75]],["d","c",[6.29,7.15,0.75]],["d","c",[7.54,4.99,0.75]],["d","c",[9.56,3.52,0.75]]]],
["ray-fan", "Ray fan", [["z","p","M3 12H21M12 3V21"],["s","p","M3 12C9 -8.8 15 32.8 21 12"]]],
["psf", "PSF", [["s","p","M3 19.5H4.7C5.3 15.2 7.4 15.2 8 19.5C9.6 19.5 10.5 4 12 4C13.5 4 14.4 19.5 16 19.5C16.6 15.2 18.7 15.2 19.3 19.5H21"]]],
["mtf", "MTF", [["z","p","M4 3V20H21"],["s","p","M4 4.5C8.5 5.5 11 13 14 20C14.9 17.7 15.8 16.3 17 16.3C18.4 16.3 19.6 18 20.5 20"]]],
["wavefront", "Wavefront", [["s","c",[12,12,9]],["s","p","M6.3 8.5C9.5 7 14.5 7 17.7 8.5M3.8 13C9 11 15 11 20.2 13M6.3 17.2C9.5 16 14.5 16 17.7 17.2"]]],
["tolerance", "Tolerancing", [["g","p","M7 4H10Q12.5 12 10 20H7Q4.5 12 7 4Z"],["s","p","M17 7.5V13.5M14 10.5H20M14 16.5H20"],["ax","p","M2 12H12.5"]]],
["optimize", "Optimize", [["s","p","M3 5C6 19 14 19 21 4"],["lp","c",[10.4,15.6,2.8]]]],
["focus", "Focus", [["s","p","M3 6L14 12M3 18L14 12M3 12H14"],["lp","c",[15,12,1.9]],["s","p","M20 7V17"]]]
];
var UI = [
["search", "Search", [["s","c",[11,11,6.5]],["s","p","M16 16L21 21"]]],
["settings", "Settings", [["s","p","M4 7H20M4 12H20M4 17H20"],["k","c",[9,7,2]],["k","c",[15,12,2]],["k","c",[7.5,17,2]]]],
["add", "Add", [["s","p","M12 5V19M5 12H19"]]],
["delete", "Delete", [["s","p","M4 7H20M9 7V4.5H15V7M6.5 7L7.5 20H16.5L17.5 7M10 11V16M14 11V16"]]],
["export", "Export", [["s","p","M12 15V3M8 7L12 3L16 7M5 12V20H19V12"]]],
["import", "Import", [["s","p","M12 3V15M8 11L12 15L16 11M5 14V20H19V14"]]],
["undo", "Undo", [["s","p","M9 5L4 10L9 15M4 10H15A5 5 0 0 1 15 20H11"]]],
["redo", "Redo", [["s","p","M15 5L20 10L15 15M20 10H9A5 5 0 0 0 9 20H13"]]],
["copy", "Copy", [["s","r",[8,8,12,12,2]],["s","p","M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5V14.5A1.5 1.5 0 0 0 5.5 16H8"]]],
["visible", "Visible", [["s","p","M2.5 12C5 7 8.5 5 12 5S19 7 21.5 12C19 17 15.5 19 12 19S5 17 2.5 12Z"],["s","c",[12,12,3]]]],
["lock", "Lock", [["s","r",[5,11,14,10,2]],["s","p","M8 11V8A4 4 0 0 1 16 8V11"]]],
["close", "Close", [["s","p","M6 6L18 18M18 6L6 18"]]],
["check", "Done", [["s","p","M5 12.5L10 17.5L19 7"]]],
["info", "Info", [["s","c",[12,12,9]],["s","p","M12 11V16.5"],["d","c",[12,7.8,1.1]]]],
["warning", "Warning", [["s","p","M12 3.5L21.5 20H2.5Z"],["s","p","M12 10V14"],["d","c",[12,17,1.1]]]],
["run", "Run", [["s","p","M8 5V19L19 12Z"]]],
["branch", "Branch", [["s","c",[6,5.5,2]],["s","c",[6,18.5,2]],["s","c",[18,7,2]],["s","p","M6 7.5V16.5M18 9C18 14 8.5 12 6.8 16.6"]]],
["comment", "Comment", [["s","p","M4 5H20V16H10L6 20V16H4Z"]]],
["chevron", "Expand", [["s","p","M6 9L12 15L18 9"]]]
];


var ISTYLE = { line: { w: 1.5, cap: "round", join: "round", axis: false }, glass: { w: 1.5, cap: "round", join: "round", axis: false }, blueprint: { w: 1.25, cap: "butt", join: "miter", axis: true } };
/* One icon as inline SVG. style: "line" (interface default), "glass" (optical objects at 24 px and up), "blueprint" (documentation).
   Line and blueprint use currentColor; glass adds var(--glass-crown), var(--glass-flint) and var(--accent). */
export function icon(name, o) {
  o = o || {}; var style = o.style || "line", set = ISTYLE[style], size = o.size || 16;
  var def = OPT.concat(UI).filter(function (i) { return i[0] === name; })[0];
  if (!def) return "";
  var body = def[2].map(function (e) {
    var role = e[0], type = e[1], a = e[2], sw = role === "z" ? (set.axis ? .75 : 1) : role === "ax" ? .75 : set.w, fill = "none", stroke = "currentColor", extra = "";
    if (role === "ax") { if (!set.axis) return ""; extra = ' stroke-dasharray="1.5 1.5"'; }
    if (role === "rf") extra = set.cap === "round" ? ' stroke-dasharray="0.01 3"' : ' stroke-dasharray="1.5 2"';
    if (role === "d") { fill = "currentColor"; stroke = "none"; }
    if (role === "lp") { fill = style === "glass" ? "var(--accent)" : "currentColor"; stroke = "none"; }
    if (role === "lb" && style === "glass") stroke = "var(--accent)";
    if (role === "g" && style === "glass") fill = "var(--glass-crown)";
    if (role === "f" && style === "glass") fill = "var(--glass-flint)";
    if (role === "k") fill = "var(--surface)";
    var at = ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (stroke === "none" ? 0 : sw) + '" stroke-linecap="' + (role === "rf" && set.cap === "round" ? "round" : set.cap) + '" stroke-linejoin="' + set.join + '"' + extra;
    if (type === "p") return '<path d="' + a + '"' + at + "/>";
    if (type === "c") return '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '"' + at + "/>";
    return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="' + a[4] + '"' + at + "/>";
  }).join("");
  var label = o.label ? ' role="img" aria-label="' + o.label + '"' : ' aria-hidden="true" focusable="false"';
  return '<svg class="eleo-icon" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' + label + ">" + body + "</svg>";
}
export var ICONS = { optical: OPT.map(function (i) { return { name: i[0], title: i[1] }; }), interface: UI.map(function (i) { return { name: i[0], title: i[1] }; }) };
