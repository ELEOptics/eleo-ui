// Builds dist/: ES modules (shared chunks, so "@eleoptics/plots/sample" registers on the same renderers
// as "@eleoptics/plots") and classic scripts for pages without a bundler, each adding to window.ELEO.
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
await build({
  entryPoints: { index: 'src/index.js', sample: 'src/sample.js', physics: 'src/physics.js' },
  outdir: 'dist', bundle: true, format: 'esm', splitting: true, target: 'es2020', chunkNames: 'chunks/[name]-[hash]',
});
for (const [name, entry] of [['eleo-plots', 'src/iife.js'], ['eleo-plots-sample', 'src/iife-sample.js'], ['eleo-physics', 'src/iife-physics.js']]) {
  await build({ entryPoints: [entry], outfile: `dist/${name}.js`, bundle: true, format: 'iife', target: 'es2017', minify: true, legalComments: 'none' });
}
cpSync('src/plots.css', 'dist/plots.css');
for (const f of ['index', 'physics', 'sample']) cpSync(`src/${f}.d.ts`, `dist/${f}.d.ts`);
