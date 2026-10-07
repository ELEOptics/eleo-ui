// Per-glass fills in layout2D (plan #90). Run after `npm run build`.
import { test, expect } from '@playwright/test';
import { differenceCiede2000, oklch, parse } from 'culori';

const deltaE = differenceCiede2000();
const lightness = (c) => oklch(parse(c)).l;
// The glass-blue band, oklch (plan #90, O1). L and chroma get 0.005 for rounding to rgb; hue gets 1°, because
// at chroma ≤ .10 one rgb step moves the hue by more than 0.005°.
const BAND_L = { light: [0.66, 0.93], dark: [0.26, 0.52] };
const BAND_TOL = 0.005, HUE_TOL = 1;

// O1 (plan #90): each {name, nd, vd} glass gets its own fill. tests/fixtures/glass-fills.html draws 200 seeded
// designs of 2 to 8 distinct glasses from tests/fixtures/glasses.json (a name may repeat across lenses) and the
// five recorded website layouts, with eleo-layout.js alone, in a light and a dark column, and reads each lens
// polygon's computed fill, which must also lie in the glass-blue band.
// oracle: property roadmap U12: pairwise ΔE2000 ≥ 8 between fills in both themes (culori); the same name gives the same fill; at equal nd, a lower vd never gives a lighter fill
test('glass fills are distinct, stable and ordered', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/tests/fixtures/glass-fills.html');
  await expect(page.locator('body[data-ready]')).toHaveCount(1);
  expect(errors).toEqual([]);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  const { designs, website, tokens } = await page.evaluate(() => window.GLASS_FILLS);
  expect(designs).toHaveLength(200);

  let orderedPairs = 0;
  for (const [d, { glasses, fills }] of designs.entries()) {
    const names = [...new Set(glasses.map((g) => g.name))];
    expect(names.length, `design ${d}: distinct glasses`).toBeGreaterThanOrEqual(2);
    expect(names.length, `design ${d}: distinct glasses`).toBeLessThanOrEqual(8);
    for (const theme of ['light', 'dark']) {
      const f = fills[theme];
      const at = `design ${d} (${names.join(', ')}), ${theme}`;
      expect(f, `${at}: one polygon per lens`).toHaveLength(glasses.length);
      // The same name gives the same fill within the design.
      const byName = new Map();
      glasses.forEach((g, i) => {
        if (!byName.has(g.name)) byName.set(g.name, f[i]);
        expect(f[i], `${at}: ${g.name} lens ${i} keeps its glass's fill`).toBe(byName.get(g.name));
      });
      // Every object-glass fill lies in the glass-blue band (user, 2026-10-06), with slack for rounding to rgb.
      for (const [name, fill] of byName) {
        const { l, c, h } = oklch(parse(fill));
        const [lMin, lMax] = BAND_L[theme];
        expect(l, `${at}: ${name} ${fill} oklch L`).toBeGreaterThanOrEqual(lMin - BAND_TOL);
        expect(l, `${at}: ${name} ${fill} oklch L`).toBeLessThanOrEqual(lMax + BAND_TOL);
        expect(c, `${at}: ${name} ${fill} oklch chroma`).toBeLessThanOrEqual(0.10 + BAND_TOL);
        expect(h, `${at}: ${name} ${fill} oklch hue`).toBeGreaterThanOrEqual(225 - HUE_TOL);
        expect(h, `${at}: ${name} ${fill} oklch hue`).toBeLessThanOrEqual(275 + HUE_TOL);
      }
      const distinct = names.map((n) => glasses.find((g) => g.name === n));
      for (let i = 0; i < distinct.length; i++) {
        for (let j = i + 1; j < distinct.length; j++) {
          const a = distinct[i], b = distinct[j], fa = byName.get(a.name), fb = byName.get(b.name);
          const dE = deltaE(fa, fb);
          expect(dE, `${at}: ΔE2000 ${a.name} ${fa} vs ${b.name} ${fb}`).toBeGreaterThanOrEqual(8);
          // At equal nd, the lower vd is never lighter (oklch L).
          if (a.nd === b.nd && a.vd !== b.vd) {
            const [lo, hi] = a.vd < b.vd ? [a, b] : [b, a];
            const lLo = lightness(byName.get(lo.name)), lHi = lightness(byName.get(hi.name));
            expect(lLo, `${at}: nd ${a.nd}, ${lo.name} (vd ${lo.vd}) L ${lLo} lighter than ${hi.name} (vd ${hi.vd}) L ${lHi}`).toBeLessThanOrEqual(lHi + 1e-4);
            orderedPairs++;
          }
        }
      }
    }
  }
  // The ordering property was exercised, not vacuous.
  expect(orderedPairs, 'designs holding two glasses of equal nd').toBeGreaterThan(0);

  // The website's shorthand glasses still draw exactly the two token fills.
  for (const [name, byTheme] of Object.entries(website)) {
    for (const theme of ['light', 'dark']) {
      const allowed = [tokens[theme].crown, tokens[theme].flint];
      expect(byTheme[theme].length, `${name} ${theme}: lenses drawn`).toBeGreaterThan(0);
      for (const f of byTheme[theme]) expect(allowed, `${name} ${theme}: fill ${f} is a glass token`).toContain(f);
    }
  }
});
