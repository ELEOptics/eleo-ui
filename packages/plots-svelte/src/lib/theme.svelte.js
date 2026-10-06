// Canvas plots read token colors when they draw, so they redraw when the theme changes: reading
// themeTick() inside an $effect re-runs it on a data-theme or data-palette change or an OS light/dark switch.
let version = $state(0);
let watching = false;

export function themeTick() {
  if (!watching && typeof window !== 'undefined') {
    watching = true;
    new MutationObserver(() => version++).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'class'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => version++);
  }
  return version;
}
