/** ELEO design tokens as data. For the web, prefer "@eleoptics/tokens/tokens.css". */
declare const tokens: {
  themes: string[];
  /** Theme-dependent values (colors, shadows): tokens.color[name][theme]. */
  color: Record<string, Record<string, string>>;
  /** Spacing, radius, stroke, dash and marker values. */
  size: Record<string, string>;
  font: { sans: string; mono: string };
  type: { name: string; family: string; styles: Record<string, unknown>[] }[];
};
export default tokens;
