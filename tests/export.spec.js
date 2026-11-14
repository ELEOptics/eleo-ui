// Export a plot as SVG and PNG (plan #1076). Run after `npm run build`.
// oracle: property U15's size rule; property: at scale 1, pixels match the standalone SVG and the tile within 0.5% exact misses; at scale k, the PNG box-averaged to 1x matches a DPR-k tile shot box-averaged to 1x outside text within 1%
// (CR #1116; a pixel matches when one within 1 px is within the channel tolerance; CR #1119: exact at scale 1); every used face embedded and loadable with the network blocked
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const TILE = '.theme[data-theme="light"] [data-tile="mtf"] svg';

// A pixel differs when any channel differs by more than this (CR #1089; the 1% budget is unchanged).
const CHANNEL_TOL = 16;

// Screenshot of a tile at its own size. The tile sits at a fractional offset, so locator.screenshot() rounds its box up a pixel
// and the half-pixel offset blurs every glyph against the export. Move it onto the pixel grid, then clip to its width and height.
// scrollIntoViewIfNeeded can leave scrollY at x.5, and Firefox then paints the tile half a pixel off its rect: round the scroll first (CR #1119).
// The tile goes to x = 0, where the exports are drawn: Chromium and WebKit rasterise the layout2D ray polylines (non-scaling-stroke under a large matrix) by position, and the same
// markup differs 0.6-1.0% (tolerance 16) between x = 45 and x = 0 while an inline copy and an <img> at the same x agree exactly (#1085).
const tileShot = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(Math.round(window.scrollX), Math.round(window.scrollY)));
  await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.style.position = 'relative';
    el.style.left = `${(parseFloat(el.style.left) || 0) - r.x}px`;
    el.style.top = `${(parseFloat(el.style.top) || 0) + Math.round(r.y) - r.y}px`;
  });
  // A whole number of device pixels, as png() and wholePixel round their sizes (a fractional clip is cut to a size they do not share).
  const size = await locator.evaluate((el) => { const r = el.getBoundingClientRect(), k = window.devicePixelRatio; return [Math.round(r.width * k) / k, Math.round(r.height * k) / k]; });
  const box = await locator.boundingBox();
  return page.screenshot({ clip: { x: box.x, y: box.y, width: size[0], height: size[1] } });
};

// Fraction of pixels of a that miss b, both base64 PNGs decoded in the page with createImageBitmap and getImageData (as map2d.spec.js:20 reads a canvas; no pixelmatch).
// A pixel of a matches when any pixel within `radius` pixels of it in b is within CHANNEL_TOL (a channel differs by more than that). Images of different sizes differ completely (1).
// Radius 1 at scale k (CR #1116): an exact match there is too strict, Chromium's on the ray tiles is 1.05-1.45% at scale 2, as the on-screen rasterisation of thin lines
// and glyph edges differs from a drawn image by up to a pixel. Radius 0 at scale 1 (CR #1119): with the scroll rounded and a whole-pixel viewBox the misses are at most 0.24%,
// and a 1-px shift or a 1.25x stroke scores at least 0.87%. PNG-against-tile at scale 1 takes radius 1 and < 1% (CR #1124); O1 and PNG-against-standalone stay exact at 0.5%.
// Pixels inside a mask rect ([left, top, right, bottom] in image pixels, already padded) are never counted as misses (CR #1112); the budget stays all pixels.
// Returns { d: missed fraction, masked: masked fraction }.
const nearFraction = (page, a, b, mask = [], radius = 1) => page.evaluate(async ([a, b, tol, mask, radius]) => {
  const px = async (s) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
  };
  const [p, q] = [await px(a), await px(b)];
  if (p.w !== q.w || p.h !== q.h) return { d: 1, masked: 0 };
  const far = (i, j) => Math.max(Math.abs(p.d[i] - q.d[j]), Math.abs(p.d[i + 1] - q.d[j + 1]), Math.abs(p.d[i + 2] - q.d[j + 2]), Math.abs(p.d[i + 3] - q.d[j + 3])) > tol;
  let n = 0, masked = 0;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (mask.some(([l, t, r, bt]) => x >= l && x < r && y >= t && y < bt)) { masked++; continue; }
      const i = (y * p.w + x) * 4;
      let miss = true;
      for (let dy = -radius; dy <= radius && miss; dy++) {
        for (let dx = -radius; dx <= radius && miss; dx++) {
          const u = x + dx, v = y + dy;
          if (u >= 0 && v >= 0 && u < p.w && v < p.h && !far(i, (v * p.w + u) * 4)) miss = false;
        }
      }
      if (miss) n++;
    }
  }
  return { d: n / (p.w * p.h), masked: masked / (p.w * p.h) };
}, [a, b, CHANNEL_TOL, mask, radius]);

// #1107 (plan #1076 O2). oracle: a second tileShot leaves the tile where the first put it, on the pixel grid, so the screenshots are identical.
test('tileShot is idempotent', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  const first = await tileShot(page, svg);
  const second = await tileShot(page, svg);
  const pos = await svg.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y]; });
  expect(Number.isInteger(pos[0])).toBe(true);
  expect(Number.isInteger(pos[1])).toBe(true);
  expect(second.equals(first)).toBe(true);
});

// `svg`'s standalone string drawn at whole pixels (CR #1119): an <img> and a canvas raster at whole pixels, so a tile of fractional height would be meet-scaled.
// The root gets width and height rounded and a viewBox of the same extent in user units, anchored top left, and its background rect covers it.
// Returns { str, w, h }.
const wholePixel = (svg) => svg.evaluate(async (el) => {
  const str = await window.ELEO.standalone(el);
  const box = el.getBoundingClientRect(), w = Math.round(box.width), h = Math.round(box.height);
  const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
  const root = doc.documentElement, vb = el.viewBox && el.viewBox.baseVal;
  if (vb && vb.width) {
    const ux = vb.width / box.width, uy = vb.height / box.height;
    root.setAttribute('viewBox', `${vb.x} ${vb.y} ${w * ux} ${h * uy}`);
    root.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    const bg = root.querySelector(':scope > rect'); // standalone puts its background rect first among the shapes, after the style
    bg.setAttribute('width', w * ux); bg.setAttribute('height', h * uy);
  }
  root.setAttribute('width', `${w}px`);
  root.setAttribute('height', `${h}px`);
  return { str: new XMLSerializer().serializeToString(root), w, h };
});

// Drawn in a page with no ELEO CSS and font requests blocked, `svg`'s standalone string matches the on-screen tile within 1% and every used face loads (O1).
// bare is that page: a context.newPage() with its font requests aborted.
const checkStandalone = async (page, bare, svg) => {
  const out = await svg.evaluate((el) => window.ELEO.standalone(el));
  const whole = await wholePixel(svg);
  const hasText = await svg.evaluate((el) => el.querySelector('text') !== null);
  const shot = await tileShot(page, svg);

  await bare.goto('about:blank');
  await bare.setContent(`<body style="margin:0;background:#fff"><img id="i" width="${whole.w}" height="${whole.h}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(whole.str)}"></body>`);
  await bare.locator('#i').evaluate((i) => i.decode());
  const drawn = await bare.screenshot({ clip: { x: 0, y: 0, width: whole.w, height: whole.h } });
  expect((await nearFraction(bare, shot.toString('base64'), drawn.toString('base64'), [], 0)).d).toBeLessThan(0.005);

  // Every used face is embedded and loads.
  const faces = await bare.evaluate(async (s) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    const used = new Set();
    doc.querySelectorAll('text').forEach((t) => {
      const st = t.style;
      used.add(`${st.fontFamily.split(',')[0].replace(/["']/g, '').trim()}|${st.fontWeight || '400'}|${st.fontStyle || 'normal'}`);
    });
    const rules = [...doc.querySelectorAll('style')].flatMap((e) => [...e.textContent.matchAll(/@font-face\s*{[^}]*}/g)].map((m) => m[0]));
    const missing = [], unloadable = [];
    for (const u of used) {
      const [fam, wt, sty] = u.split('|');
      const rule = rules.find((r) => r.includes(fam) && new RegExp(`font-weight:\\s*${wt}`).test(r) && new RegExp(`font-style:\\s*${sty}`).test(r));
      if (!rule) { missing.push(u); continue; }
      const src = /url\(([^)]+)\)/.exec(rule)[1].replace(/["']/g, '');
      try { await new FontFace(fam, `url(${src})`, { weight: wt, style: sty }).load(); } catch { unloadable.push(u); }
    }
    return { n: used.size, missing, unloadable };
  }, out);
  // A tile with no text (the icons) uses no face.
  if (hasText) expect(faces.n).toBeGreaterThan(0);
  expect(faces.missing).toEqual([]);
  expect(faces.unloadable).toEqual([]);
};

// The PNG b64 box-averaged 2x2 to w x h (the tile's rounded size, which the PNG's half can miss by a pixel when the box is fractional), as base64 PNG. drawImage's own downscale skips pixels in WebKit and Firefox, which moves every thin line.
const halve = (page, b64, w, h) => page.evaluate(async ([b64, w, h]) => {
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const big = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
  big.drawImage(bmp, 0, 0);
  const src = big.getImageData(0, 0, bmp.width, bmp.height).data;
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d'), out = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let t = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) t += src[(Math.min(2 * y + dy, bmp.height - 1) * bmp.width + Math.min(2 * x + dx, bmp.width - 1)) * 4 + ch];
        out.data[(y * c.width + x) * 4 + ch] = t / 4;
      }
    }
  }
  g.putImageData(out, 0, 0);
  const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}, [b64, w, h]);

// A tile shot at deviceScaleFactor k: the gallery loaded in a context of that factor, `open(page2, k)` returning the tile there (after any state it needs), then tileShot.
// The default opens the first MTF tile.
const dprShot = async (page, k, open = (p) => p.locator(TILE).first()) => {
  const ctx = await page.context().browser().newContext({ deviceScaleFactor: k, viewport: page.viewportSize(), baseURL: new URL('/', page.url()).href });
  try {
    const p = await ctx.newPage();
    await p.goto('/gallery/');
    await expect(p.locator('body')).toHaveAttribute('data-ready', 'true');
    return await tileShot(p, await open(p, k));
  } finally {
    await ctx.close();
  }
};

// `svg`'s png at scale 1 and 2 is the plot's size times the scale; at scale 1 its pixels match the standalone SVG and the on-screen tile, at scale 2 box-averaged to 1x
// the tile shot at deviceScaleFactor 2 and box-averaged to 1x, outside the text boxes (O2).
const checkPng = async (page, svg, open) => {
  for (const scale of [1, 2]) {
    const fit = scale === 1 ? (await wholePixel(svg)).str : null;
    const r = await svg.evaluate(async (el, [scale, tol, fit]) => {
      const blob = await window.ELEO.png(el, { scale });
      const box = el.getBoundingClientRect();
      const bmp = await createImageBitmap(blob);
      const grab = (draw, w, h) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); draw(g); return g.getImageData(0, 0, w, h).data; };
      // The standalone string keeps its screen-space strokes, so only at scale 1 does it draw like the PNG: compare there only (CR #1102).
      let diff = null;
      if (scale === 1) {
        const url = URL.createObjectURL(new Blob([fit], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = url;
        try { await img.decode(); } finally { URL.revokeObjectURL(url); }
        const a = grab((g) => g.drawImage(bmp, 0, 0), bmp.width, bmp.height);
        const b = grab((g) => g.drawImage(img, 0, 0, bmp.width, bmp.height), bmp.width, bmp.height);
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3])) > tol) n++;
        diff = n / (bmp.width * bmp.height);
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), type: blob.type, w: bmp.width, h: bmp.height, bw: box.width * scale, bh: box.height * scale, diff };
    }, [scale, CHANNEL_TOL, fit]);
    expect(r.type).toBe('image/png');
    expect(Math.abs(r.w - r.bw)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.h - r.bh)).toBeLessThanOrEqual(1);
    if (scale === 1) expect(r.diff).toBeLessThan(0.005);
    // Against the on-screen tile too, so a font-load race in png cannot pass by hitting the reference image as well. Taken after png() has read the element: tileShot moves it.
    // The scale-k rule, radius 1 and < 1% (CR #1124): Chromium and WebKit raster the ray polylines differently in a canvas than on the page, and O1 plus
    // PNG-against-standalone, both exact, tie the PNG to the tile.
    if (scale === 1) {
      const shot = await tileShot(page, svg);
      const { d } = await nearFraction(page, shot.toString('base64'), r.b64, [], 1);
      expect(d).toBeLessThan(0.01);
    } else {
      // Scale 2 drawn into a canvas of half its size must still match the tile: strokes (curves with vector-effect included) scale with the PNG (CR #1102).
      // Text is left out of this comparison (CR #1112): Linux Chromium draws on-screen text with subpixel AA and hinted widths that a canvas never matches.
      // Boxes are read relative to the SVG's own rect before tileShot moves it, padded by 1 px; text against the tile stays covered at 1x above.
      const mask = await svg.evaluate((el) => {
        const o = el.getBoundingClientRect();
        return [...el.querySelectorAll('text')].map((t) => {
          const r = t.getBoundingClientRect();
          return [Math.floor(r.left - o.left) - 1, Math.floor(r.top - o.top) - 1, Math.ceil(r.right - o.left) + 1, Math.ceil(r.bottom - o.top) + 1];
        });
      });
      // A tile with no text (the icons) has no mask to check.
      if (await svg.evaluate((el) => el.querySelector('text') !== null)) expect(mask.length).toBeGreaterThan(0);
      // The reference is the tile shot at deviceScaleFactor k, box-averaged to 1x the same way as the PNG, so both sides are exact-coverage rasters (CR #1116).
      const ref = await dprShot(page, scale, open);
      const tw = Math.round(r.bw / scale), th = Math.round(r.bh / scale);
      const { d, masked } = await nearFraction(page, await halve(page, ref.toString('base64'), tw, th), await halve(page, r.b64, tw, th), mask);
      console.log(`scale-k masked fraction ${masked.toFixed(4)}, unmasked misses ${d.toFixed(4)}`);
      expect(d).toBeLessThan(0.01);
      // An oversized text box cannot hide most of the tile.
      expect(masked).toBeLessThan(0.1);
    }
  }
};

// A page with no ELEO CSS and font requests blocked.
const blockedPage = async (context) => {
  const bare = await context.newPage();
  // As large as the gallery's page, so a clip of the drawn image is not cut by the default 1280 x 720 viewport.
  await bare.setViewportSize({ width: 1440, height: 1800 });
  await bare.route('**/*', (route) => (route.request().resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(route.request().url()) ? route.abort() : route.continue()));
  return bare;
};

// Every SVG tile ([data-svg] > svg, [data-map] > svg) in both themes, plus the light MTF-limits tile zoomed and the light distortion tile hovered (O1, O2).
const SVG_TILE = ':is([data-svg], [data-map]) > svg';
const everyTile = async (page) => {
  const found = await page.evaluate((sel) => [...document.querySelectorAll('.theme[data-theme]')].flatMap((col) => [...col.querySelectorAll('[data-tile]')]
    .filter((s) => s.querySelector(sel)).map((s) => ({ theme: col.dataset.theme, tile: s.dataset.tile }))), SVG_TILE);
  const cases = found.map((c) => ({ ...c, state: 'plain', name: `${c.theme} ${c.tile}` }));
  cases.push({ theme: 'light', tile: 'mtf-limits', state: 'zoomed', name: 'light mtf-limits zoomed' }, { theme: 'light', tile: 'distortion', state: 'hovered', name: 'light distortion hovered' });
  return cases;
};
const caseSvg = (page, c) => page.locator(`.theme[data-theme="${c.theme}"] [data-tile="${c.tile}"] ${SVG_TILE}`).first();

// Put the case's tile in its state. Zoomed: a wheel notch over the plot redraws the data group's matrix(...). Hovered: the pointer on the first point of a series shows the tip;
// the hover layer is then hidden (display) so the screenshot holds the plot alone, the pointer stays where it is.
// k is the page's deviceScaleFactor: Chromium divides a wheel delta by it, so there the notch is multiplied by it to zoom as much; Firefox and WebKit do not (CR #1119).
const setState = async (page, c, svg, k = 1) => {
  await svg.scrollIntoViewIfNeeded();
  if (c.state === 'plain') return;
  const matrix = () => svg.evaluate((el) => el.querySelector('[data-series]').parentNode.getAttribute('transform'));
  if (c.state === 'zoomed') {
    const before = await matrix();
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300 * (page.context().browser().browserType().name() === 'chromium' ? k : 1));
    await expect.poll(matrix, { message: `${c.name}: the wheel zoomed` }).not.toBe(before);
  } else {
    const at = await svg.evaluate((el) => {
      const m = el.querySelector('[data-series]'), p = m.getPointAtLength(0), q = new DOMPoint(p.x, p.y).matrixTransform(m.getScreenCTM());
      return { x: q.x, y: q.y };
    });
    await page.mouse.move(Math.round(at.x), Math.round(at.y)); // whole pixels: Firefox and WebKit truncate (#1030)
    const tip = page.locator(`.theme[data-theme="${c.theme}"] [data-tile="${c.tile}"] .eleo-hover__tip`);
    await expect(tip, `${c.name}: the pointer shows the tip`).toBeVisible();
    await expect(tip).not.toHaveText('');
  }
  await svg.evaluate((el) => el.closest('[data-tile]').querySelectorAll('.eleo-hover').forEach((l) => { l.style.display = 'none'; }));
  if (c.state === 'zoomed') await page.mouse.move(2, 2);
};

// Run `check(svg)` on every case; the failures are collected so one run names every tile that breaks.
const eachTile = async (page, check) => {
  // Tall enough for the tallest tile: a clip past the viewport's bottom is cut short.
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const cases = await everyTile(page);
  expect(cases.length).toBeGreaterThan(20);
  const failed = [];
  for (const c of cases) {
    try {
      // A fresh load per case: a tile moved onto the pixel grid, zoomed or hovered would otherwise leak into the next.
      await page.goto('/gallery/');
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
      const svg = caseSvg(page, c);
      await setState(page, c, svg);
      await check(svg, async (p, k) => { const t = caseSvg(p, c); await setState(p, c, t, k); return t; });
    } catch (e) {
      failed.push(`${c.name}: ${String(e.message).split('\n').filter(Boolean).slice(0, 3).join(' | ')}`);
    }
  }
  expect(failed).toEqual([]);
};

// #1077 (plan #1076 O1). oracle: U15's 1% pixel rule; every (family, weight, style) the text uses has an embedded face that loads as a FontFace with the network blocked.
test('standalone matches', async ({ page, context }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await checkStandalone(page, await blockedPage(context), page.locator(TILE).first());
});

// #1077 (plan #1076 O2). oracle: U15's size rule (the PNG is the plot's size times the scale); at scale 1 its pixels match the standalone SVG within 1%, at scale k box-averaged to 1x a tile shot at deviceScaleFactor k, also box-averaged, outside text within 1% (1-px neighbourhood, CR #1116).
test('png size and pixels', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await checkPng(page, page.locator(TILE).first());
});

// #1120 (plan #1076 O1, O2; CR #1119). oracle: metamorphic a clone of the MTF tile with its data group shifted 1 px, or its stroke widths x 1.25, must miss the tile at the scale-1 rule
// (exact, 0.5%) while the unmodified clone passes it; the faults are injected the way the CR's spike did.
test('pixel rule catches a 1-px shift and a 1.25x stroke', async ({ page, context }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  const whole = await wholePixel(svg);
  const shot = (await tileShot(page, svg)).toString('base64');
  const bare = await blockedPage(context);
  const miss = {};
  for (const mode of ['none', 'shift', 'stroke']) {
    await bare.setContent(`<body style="margin:0;background:#fff"><div style="line-height:0">${whole.str}</div></body>`);
    await bare.evaluate(async (mode) => {
      await document.fonts.ready;
      const root = document.querySelector('svg');
      if (mode === 'stroke') {
        root.querySelectorAll('*').forEach((e) => {
          const sw = e.style.getPropertyValue('stroke-width');
          if (sw && e.style.getPropertyValue('stroke') !== 'none' && e.localName !== 'text') e.style.setProperty('stroke-width', `${parseFloat(sw) * 1.25}px`);
        });
      }
      if (mode === 'shift') {
        // The data group is the parent of the series paths; one screen pixel right, in the coordinates of the group's parent.
        const g = root.querySelector('[data-series]').parentNode, inv = g.parentNode.getCTM().inverse();
        const p0 = new DOMPoint(0, 0).matrixTransform(inv), p1 = new DOMPoint(1, 0).matrixTransform(inv);
        const t = root.createSVGTransform();
        t.setTranslate(p1.x - p0.x, p1.y - p0.y);
        g.transform.baseVal.insertItemBefore(t, 0);
      }
    }, mode);
    const drawn = await bare.screenshot({ clip: { x: 0, y: 0, width: whole.w, height: whole.h } });
    miss[mode] = (await nearFraction(bare, shot, drawn.toString('base64'), [], 0)).d;
  }
  expect(miss.none).toBeLessThan(0.005);
  expect(miss.shift).toBeGreaterThanOrEqual(0.005);
  expect(miss.stroke).toBeGreaterThanOrEqual(0.005);
});

// #1084 (plan #1076 O1). oracle: U15's 1% pixel rule and every used face embedded and loadable, on every SVG tile in both themes, one zoomed and one hovered (the hover layer is not part of the plot).
test('standalone matches (every tile)', async ({ page, context }) => {
  test.setTimeout(300000);
  const bare = await blockedPage(context);
  await eachTile(page, (svg) => checkStandalone(page, bare, svg));
});

// #1084 (plan #1076 O2). oracle: U15's size rule and the scale 1 and scale k pixel rules of `png size and pixels`, on every SVG tile in both themes, one zoomed and one hovered.
test('png size and pixels (every tile)', async ({ page }) => {
  test.setTimeout(900000); // each case also opens a context at the scale factor
  await eachTile(page, (svg, open) => checkPng(page, svg, open));
});

// #1084 (plan #1076 O3). oracle: property the SVG and PNG x2 buttons in the MTF tile's .eleo-plot__actions download files equal to standalone()'s string and a PNG twice the plot's size.
test('gallery save', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const tile = page.locator('.theme[data-theme="light"] [data-tile="mtf"]');
  const svg = tile.locator('svg').first();
  await tile.scrollIntoViewIfNeeded();
  const [svgDl] = await Promise.all([page.waitForEvent('download'), tile.locator('.eleo-plot__hd .eleo-plot__actions button', { hasText: /^SVG$/ }).click()]);
  const saved = await readFile(await svgDl.path(), 'utf8');
  expect(saved).toBe(await svg.evaluate((el) => window.ELEO.standalone(el)));
  const [pngDl] = await Promise.all([page.waitForEvent('download'), tile.locator('.eleo-plot__hd .eleo-plot__actions button', { hasText: /^PNG ×2$/ }).click()]);
  const png = await readFile(await pngDl.path());
  // IHDR: bytes 16-19 width, 20-23 height, big endian.
  const size = await svg.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  expect(Math.abs(png.readUInt32BE(16) - size[0] * 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(png.readUInt32BE(20) - size[1] * 2)).toBeLessThanOrEqual(1);
});

// #1078 (plan #1076 O1, styles only). oracle: the string has no var( and its background rect and tick fills equal the tile's computed values; drawn in a page with no ELEO CSS.
test('styles resolve without ELEO CSS', async ({ page, context }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  const out = await svg.evaluate((el) => window.ELEO.standalone(el, { fonts: false }));
  const want = await svg.evaluate((el) => {
    const t = el.querySelector('text');
    const r = el.getBoundingClientRect();
    return { surface: getComputedStyle(el).getPropertyValue('--surface').trim(), tick: getComputedStyle(t).fill, w: r.width, h: r.height };
  });
  expect(out).not.toContain('var(');
  expect(out).not.toMatch(/stop-(color|opacity)/);

  const bare = await context.newPage();
  await bare.goto('about:blank');
  const got = await bare.evaluate(async (s) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    const root = doc.documentElement;
    const probe = document.createElement('div');
    const norm = (c) => { probe.style.color = ''; probe.style.color = c; document.body.append(probe); const v = getComputedStyle(probe).color; probe.remove(); return v; };
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
    await img.decode();
    return { ns: root.namespaceURI, w: root.getAttribute('width'), h: root.getAttribute('height'), rect: norm(root.firstElementChild.style.fill || root.firstElementChild.getAttribute('fill')), tick: norm(root.querySelector('text').style.fill), tag: root.firstElementChild.tagName };
  }, out);
  const norm = await bare.evaluate((c) => { const d = document.createElement('div'); d.style.color = c; document.body.append(d); return getComputedStyle(d).color; }, want.surface);
  expect(got.ns).toBe('http://www.w3.org/2000/svg');
  expect(got.tag).toBe('rect');
  expect(got.rect).toBe(norm);
  expect(got.tick).toBe(want.tick);
  expect(got.w).toBe(`${want.w}px`);
  expect(got.h).toBe(`${want.h}px`);
});

// #1079 (plan #1076 O1, fonts only). oracle: every (family, weight, style) the text uses has an embedded @font-face rule whose url() is a data URL and that loads as a FontFace with font requests blocked.
test('used faces embedded', async ({ page, context }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  const out = await svg.evaluate((el) => window.ELEO.standalone(el));

  const bare = await context.newPage();
  // As large as the gallery's page, so a clip of the drawn image is not cut by the default 1280 x 720 viewport.
  await bare.setViewportSize({ width: 1440, height: 1800 });
  await bare.route('**/*', (route) => (route.request().resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(route.request().url()) ? route.abort() : route.continue()));
  await bare.goto('about:blank');
  const r = await bare.evaluate(async (s) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    const used = new Set();
    doc.querySelectorAll('text').forEach((t) => {
      const st = t.style;
      used.add(`${st.fontFamily.split(',')[0].replace(/["']/g, '').trim()}|${st.fontWeight || '400'}|${st.fontStyle || 'normal'}`);
    });
    const rules = [...doc.querySelectorAll('style')].flatMap((e) => [...e.textContent.matchAll(/@font-face\s*{[^}]*}/g)].map((m) => m[0]));
    const remote = rules.filter((x) => /url\(\s*(?!["']?data:)/.test(x));
    const missing = [], unloadable = [];
    for (const u of used) {
      const [fam, wt, sty] = u.split('|');
      const rule = rules.find((x) => x.includes(fam) && new RegExp(`font-weight:\\s*${wt}`).test(x) && new RegExp(`font-style:\\s*${sty}`).test(x));
      if (!rule) { missing.push(u); continue; }
      const src = /url\(([^)]+)\)/.exec(rule)[1].replace(/["']/g, '');
      try { await new FontFace(fam, `url(${src})`, { weight: wt, style: sty }).load(); } catch { unloadable.push(u); }
    }
    return { n: used.size, rules: rules.length, remote: remote.length, missing, unloadable };
  }, out);
  expect(r.n).toBeGreaterThan(0);
  expect(r.remote).toBe(0);
  expect(r.missing).toEqual([]);
  expect(r.unloadable).toEqual([]);
});

// #1093 (plan #1076 O1, O2). oracle: faces in @import, @layer and @media are embedded; each used family left without a face is named in one console.warn.
test('nested and unmatched faces', async ({ page }) => {
  const warns = [];
  page.on('console', (m) => m.type() === 'warning' && warns.push(m.text()));
  const face = (fam) => `@font-face { font-family: ${fam}; font-weight: 400; src: url(data:font/woff2;base64,eHg=); }`;
  await page.route('**/probe-import.css', (r) => r.fulfill({ contentType: 'text/css', body: face('ProbeImp') }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const out = await page.evaluate(async ([layer, media]) => {
    const st = document.createElement('style');
    st.textContent = `@import url(/probe-import.css); @layer a { ${layer} } @media screen { ${media} }`;
    document.head.prepend(st);
    await new Promise((ok) => setTimeout(ok, 300));
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10">' + ['ProbeImp', 'ProbeLayer', 'ProbeMedia', 'ProbeNone'].map((f) => `<text style="font-family: ${f}">a</text>`).join('') + '</svg>';
    return window.ELEO.standalone(host.firstChild);
  }, [face('ProbeLayer'), face('ProbeMedia')]);
  const sty = (out.match(/<style[\s\S]*?<\/style>/) || [''])[0];
  expect(sty).toContain('ProbeImp');
  expect(sty).toContain('ProbeLayer');
  expect(sty).toContain('ProbeMedia');
  const ours = warns.filter((w) => w.includes('standalone'));
  expect(ours).toHaveLength(1);
  expect(ours[0]).toContain('ProbeNone');
  expect(ours[0]).not.toMatch(/ProbeImp|ProbeLayer|ProbeMedia/);
});

// #1094: keyword weights read as 400 and 700, and families compare case-insensitively.
test('keyword weights and family case', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const out = await page.evaluate(async () => {
    const face = (fam, wt) => `@font-face { font-family: ${fam}; font-weight: ${wt}; src: url(data:font/woff2;base64,eHg=); }`;
    const st = document.createElement('style');
    st.textContent = face('ProbeNorm', 'normal') + face('ProbeBld', 'bold') + face('ProbeNum', 400);
    document.head.prepend(st);
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: ProbeNorm; font-weight: 400">a</text><text style="font-family: ProbeBld; font-weight: bold">a</text><text style="font-family: probenum">a</text></svg>';
    return window.ELEO.standalone(host.firstChild);
  });
  const sty = (out.match(/<style[\s\S]*?<\/style>/) || [''])[0];
  for (const f of ['ProbeNorm', 'ProbeBld', 'ProbeNum']) expect(sty).toContain(f);
});

// #1095 (plan #1076 O1, O2). oracle: a face whose URL fails is not embedded, its family is named in the one warning, and standalone still resolves.
test('failed font fetch', async ({ page }) => {
  const warns = [];
  page.on('console', (m) => m.type() === 'warning' && warns.push(m.text()));
  await page.route('**/probe-missing.woff2', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const out = await page.evaluate(async () => {
    const st = document.createElement('style');
    st.textContent = '@font-face { font-family: ProbeGone; font-weight: 400; src: url(/probe-missing.woff2); } @font-face { font-family: ProbeOk; font-weight: 400; src: url(data:font/woff2;base64,eHg=); }';
    document.head.prepend(st);
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: ProbeGone">a</text><text style="font-family: ProbeOk">a</text></svg>';
    return window.ELEO.standalone(host.firstChild);
  });
  const sty = (out.match(/<style[\s\S]*?<\/style>/) || [''])[0];
  expect(sty).toContain('ProbeOk');
  expect(sty).not.toContain('ProbeGone');
  const ours = warns.filter((w) => w.includes('standalone'));
  expect(ours).toHaveLength(1);
  expect(ours[0]).toContain('ProbeGone');
  expect(ours[0]).not.toContain('ProbeOk');
});

// #1099 (plan #1076 O1). oracle: generic families never warn; a family with one face embedded and one failed is named as partly embedded, not as not embedded.
test('warning names only missing faces', async ({ page }) => {
  const warns = [];
  page.on('console', (m) => m.type() === 'warning' && warns.push(m.text()));
  await page.route('**/probe-greek.woff2', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    const st = document.createElement('style');
    st.textContent = '@font-face { font-family: ProbePart; font-weight: 400; unicode-range: U+0000-00FF; src: url(data:font/woff2;base64,eHg=); } @font-face { font-family: ProbePart; font-weight: 400; unicode-range: U+0370-03FF; src: url(/probe-greek.woff2); }';
    document.head.prepend(st);
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: sans-serif">a</text></svg>';
    await window.ELEO.standalone(host.firstChild);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: -apple-system, BlinkMacSystemFont, sans-serif">a</text></svg>';
    await window.ELEO.standalone(host.firstChild);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: BlinkMacSystemFont, sans-serif">a</text></svg>';
    await window.ELEO.standalone(host.firstChild);
    host.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><text style="font-family: ProbePart">a\u03bc</text></svg>';
    await window.ELEO.standalone(host.firstChild);
  });
  const ours = warns.filter((w) => w.includes('standalone'));
  expect(ours).toHaveLength(1);
  expect(ours[0]).not.toContain('sans-serif');
  expect(ours[0]).not.toMatch(/apple-system|BlinkMacSystemFont/);
  expect(ours[0]).toMatch(/partly embedded[^]*ProbePart/);
  expect(ours[0]).not.toMatch(/not embedded[^]*ProbePart/);
});

// #1079: the Google Fonts link must be CORS-readable so its cssRules can be read.
test('gallery fonts link is crossorigin', async ({ page }) => {
  await page.goto('/gallery/');
  const attrs = await page.evaluate(() => [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map((l) => l.crossOrigin));
  expect(attrs.length).toBeGreaterThan(0);
  expect(attrs.every((a) => a === 'anonymous')).toBe(true);
});

// #1080 (plan #1076 O2, type and size only). oracle: U15's size rule (the PNG is the plot's size times the scale, within 1 px); every map tile's plot svg resolves a non-empty image/png (no canvas taint).
test('png resolves a PNG of the plot\'s size times scale', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  for (const scale of [1, 2]) {
    const r = await page.locator(TILE).first().evaluate(async (el, scale) => {
      const blob = await window.ELEO.png(el, { scale });
      const bmp = await createImageBitmap(blob);
      const box = el.getBoundingClientRect();
      return { type: blob.type, dw: Math.abs(bmp.width - box.width * scale), dh: Math.abs(bmp.height - box.height * scale) };
    }, scale);
    expect(r.type).toBe('image/png');
    expect(r.dw).toBeLessThanOrEqual(1);
    expect(r.dh).toBeLessThanOrEqual(1);
  }
  const maps = await page.locator('[data-map] > svg').evaluateAll((els) => Promise.all(els.map(async (el) => {
    const b = await window.ELEO.png(el);
    return { type: b.type, size: b.size };
  })));
  expect(maps.length).toBeGreaterThan(0);
  for (const m of maps) { expect(m.type).toBe('image/png'); expect(m.size).toBeGreaterThan(0); }
});

// #1108 (plan #1076 O2). oracle: png multiplies a non-scaling stroke's px or unitless stroke-width, stroke-dasharray and stroke-dashoffset by scale; a % value is left as it is (browsers keep % in computed style; em and rem arrive as px).
test('png scales px strokes only', async ({ page }) => {
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', 40); svg.setAttribute('height', 40);
    const mk = (id, width, dash, off) => {
      const l = document.createElementNS(NS, 'line');
      l.id = id; l.setAttribute('vector-effect', 'non-scaling-stroke');
      l.style.strokeWidth = width; l.style.strokeDasharray = dash;
      l.setAttribute('stroke-dashoffset', off);
      svg.appendChild(l);
    };
    mk('px', '2px', '2px 3px', '1');
    mk('pct', '1%', '1% 2%', '1%');
    mk('mixed', '3', '4px 5%', '2px');
    document.body.appendChild(svg);
    const real = URL.createObjectURL;
    let pending;
    URL.createObjectURL = (b) => { pending = b.text(); return real(b); };
    try { await window.ELEO.png(svg, { scale: 2, fonts: false }); } finally { URL.createObjectURL = real; svg.remove(); }
    const text = await pending;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const get = (id) => { const e = doc.getElementById(id), s = e.style; return [s.getPropertyValue('stroke-width'), s.getPropertyValue('stroke-dasharray'), e.getAttribute('stroke-dashoffset')]; };
    return { px: get('px'), pct: get('pct'), mixed: get('mixed') };
  });
  expect(r.px).toEqual(['4px', '4px, 6px', '2']);
  expect(r.pct).toEqual(['1%', '1%, 2%', '1%']);
  expect(r.mixed).toEqual(['6px', '8px, 5%', '4']);
});
