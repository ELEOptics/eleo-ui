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
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), type: blob.type, w: bmp.width, h: bmp.height, bw: box.width * scale, bh: box.height * scale, diff: n / (bmp.width * bmp.height) };
    }, [scale, CHANNEL_TOL]);
    expect(r.type).toBe('image/png');
    expect(Math.abs(r.w - r.bw)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.h - r.bh)).toBeLessThanOrEqual(1);
    expect(r.diff).toBeLessThan(0.01);
    // Against the on-screen tile too, so a font-load race in png cannot pass by hitting the reference image as well. Taken after png() has read the element: tileShot moves it.
    if (scale === 1) {
      const shot = await tileShot(page, svg);
      const d = await diffFraction(page, shot.toString('base64'), r.b64);
      expect(d).toBeLessThan(0.01);
    }
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
