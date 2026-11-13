// Export a plot as SVG and PNG (plan #1076). Run after `npm run build`.
// oracle: property U15's 1% pixel rule (the export matches the on-screen tile within 1% of pixels), U15's size rule (the PNG is the plot's size times the scale),
// every used face embedded and loadable with the network blocked
import { test, expect } from '@playwright/test';

const TILE = '.theme[data-theme="light"] [data-tile="mtf"] svg';

// A pixel differs when any channel differs by more than this (CR #1089; the 1% budget is unchanged).
const CHANNEL_TOL = 16;

// Screenshot of a tile at its own size. The tile sits at a fractional offset, so locator.screenshot() rounds its box up a pixel
// and the half-pixel offset blurs every glyph against the export. Move it onto the pixel grid, then clip to its width and height.
const tileShot = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.style.position = 'relative';
    el.style.left = `${Math.round(r.x) - r.x}px`;
    el.style.top = `${Math.round(r.y) - r.y}px`;
  });
  const size = await locator.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  const box = await locator.boundingBox();
  return page.screenshot({ clip: { x: box.x, y: box.y, width: size[0], height: size[1] } });
};

// Fraction of pixels whose channels differ by more than CHANNEL_TOL between two images, decoded in the page with createImageBitmap and getImageData
// (as map2d.spec.js:20 reads a canvas; no pixelmatch). Images of different sizes differ completely (1). a and b are base64 PNGs.
const diffFraction = (page, a, b) => page.evaluate(async ([a, b, tol]) => {
  const px = async (s) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
  };
  const [p, q] = [await px(a), await px(b)];
  if (p.w !== q.w || p.h !== q.h) return 1;
  let n = 0;
  for (let i = 0; i < p.d.length; i += 4) {
    if (Math.max(Math.abs(p.d[i] - q.d[i]), Math.abs(p.d[i + 1] - q.d[i + 1]), Math.abs(p.d[i + 2] - q.d[i + 2]), Math.abs(p.d[i + 3] - q.d[i + 3])) > tol) n++;
  }
  return n / (p.w * p.h);
}, [a, b, CHANNEL_TOL]);

// #1077 (plan #1076 O1). oracle: U15's 1% pixel rule; every (family, weight, style) the text uses has an embedded face that loads as a FontFace with the network blocked.
test('standalone matches', async ({ page, context }) => {
  test.skip(true, 'unskipped by #1083; ELEO.standalone arrives in #1078 and #1079');
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  const out = await svg.evaluate((el) => window.ELEO.standalone(el));
  const size = await svg.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  const shot = await tileShot(page, svg);

  // A page with no ELEO CSS and font requests blocked.
  const bare = await context.newPage();
  await bare.route('**/*', (route) => (route.request().resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(route.request().url()) ? route.abort() : route.continue()));
  await bare.goto('about:blank');
  await bare.setContent(`<body style="margin:0;background:#fff"><img id="i" width="${size[0]}" height="${size[1]}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(out)}"></body>`);
  await bare.locator('#i').evaluate((i) => i.decode());
  const drawn = await bare.locator('#i').screenshot();
  expect(await diffFraction(bare, shot.toString('base64'), drawn.toString('base64'))).toBeLessThan(0.01);

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
  expect(faces.n).toBeGreaterThan(0);
  expect(faces.missing).toEqual([]);
  expect(faces.unloadable).toEqual([]);
});

// #1077 (plan #1076 O2). oracle: U15's size rule (the PNG is the plot's size times the scale); its pixels match the standalone SVG drawn at that scale within 1%.
test('png size and pixels', async ({ page }) => {
  test.skip(true, 'unskipped by #1083; ELEO.png arrives in #1080');
  await page.goto('/gallery/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const svg = page.locator(TILE).first();
  for (const scale of [1, 2]) {
    const r = await svg.evaluate(async (el, [scale, tol]) => {
      const blob = await window.ELEO.png(el, { scale });
      const str = await window.ELEO.standalone(el);
      const box = el.getBoundingClientRect();
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
      await img.decode();
      const bmp = await createImageBitmap(blob);
      const grab = (draw, w, h) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); draw(g); return g.getImageData(0, 0, w, h).data; };
      const a = grab((g) => g.drawImage(bmp, 0, 0), bmp.width, bmp.height);
      const b = grab((g) => g.drawImage(img, 0, 0, bmp.width, bmp.height), bmp.width, bmp.height);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3])) > tol) n++;
      return { type: blob.type, w: bmp.width, h: bmp.height, bw: box.width * scale, bh: box.height * scale, diff: n / (bmp.width * bmp.height) };
    }, [scale, CHANNEL_TOL]);
    expect(r.type).toBe('image/png');
    expect(Math.abs(r.w - r.bw)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.h - r.bh)).toBeLessThanOrEqual(1);
    expect(r.diff).toBeLessThan(0.01);
  }
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
