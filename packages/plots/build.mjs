// Builds dist/: ES modules (shared chunks) and classic scripts for pages without a bundler, each adding to window.ELEO.
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
await build({
  entryPoints: { index: 'src/index.js', physics: 'src/physics.js', layout3d: 'src/layout3d.js' },
  outdir: 'dist', bundle: true, format: 'esm', splitting: true, target: 'es2020', chunkNames: 'chunks/[name]-[hash]', external: ['three', 'three/*'],
});
for (const [name, entry] of [['eleo-plots', 'src/iife.js'], ['eleo-physics', 'src/iife-physics.js'], ['eleo-layout', 'src/iife-layout.js'], ['eleo-layout3d', 'src/iife-layout3d.js']]) {
  await build({ entryPoints: [entry], outfile: `dist/${name}.js`, bundle: true, format: 'iife', target: 'es2017', minify: true, legalComments: 'none' });
}
cpSync('src/plots.css', 'dist/plots.css');
for (const f of ['index', 'physics', 'layout3d']) cpSync(`src/${f}.d.ts`, `dist/${f}.d.ts`);
