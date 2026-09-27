// Bundles the app into one self-contained HTML file, dist/boop.html, for sharing as a single page.
// Also writes dist/artifact.html, the same page without the document wrapper,
// for hosts that supply their own <html>/<head>/<body>. The repo itself runs without this step.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

const result = await build({
  entryPoints: [new URL('js/app.js', root).pathname],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
});
// data-single tells the page it's the one-file copy, which has no service worker to register.
const js = `document.documentElement.dataset.single = '';\n${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}`;

// A single file can't point at other files, so the fonts and the icon go in as data: URIs,
// and the links that only make sense for the hosted site (manifest, home-screen icon, preloads) come out.
const dataUri = async (path, type) => `data:${type};base64,${(await readFile(new URL(path, root))).toString('base64')}`;
let css = await read('css/app.css');
// Pages shown inside a host that has its own light/dark switch get data-theme on <html>:
// follow the system setting unless it says light, and go dark when it says dark.
const blocks = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{\n  (:root|body) \{([^}]*)\}\n\}/g)];
if (blocks.length !== 2) throw new Error('css/app.css: expected two dark blocks, found ' + blocks.length);
for (const [whole, sel, rules] of blocks) {
  const guarded = sel === ':root' ? ':root:not([data-theme="light"])' : ':root:not([data-theme="light"]) body';
  const forced = sel === ':root' ? ':root[data-theme="dark"]' : ':root[data-theme="dark"] body';
  css = css.replace(whole, `@media (prefers-color-scheme: dark) {\n  ${guarded} {${rules}}\n}\n${forced} {${rules}}`);
}
for (const [, file] of css.matchAll(/url\(\.\.\/(fonts\/[^)]+\.woff2)\)/g)) css = css.replace(`url(../${file})`, `url(${await dataUri(file, 'font/woff2')})`);
const icon = await dataUri('icon.svg', 'image/svg+xml');
const html = (await read('index.html'))
  .replace(/ *<link rel="(manifest|apple-touch-icon|preload)"[^>]*>\n/g, '')
  .replaceAll('"icon.svg"', () => `"${icon}"`)
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${css}</style>`)
  .replace(/ *<script type="module" src="js\/app.js"><\/script>\n/, '')
  .replace('</body>', () => `<script>\n${js}</script>\n</body>`);

const fragment = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body[^>]*>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');

// That host pads the page clear of a phone's notch and home bar itself, so the page fills what's left instead of the whole screen.
const swaps = [
  ['padding: calc(10px + env(safe-area-inset-top)) 16px 4px;', 'padding: 10px 16px 4px;'],
  ['padding: 0 16px calc(14px + env(safe-area-inset-bottom));', 'padding: 0 16px 14px;'],
  ['  margin: 0;\n  min-height: 100dvh;', '  margin: 0;\n  height: 100%;\n  min-height: 100%;'],
  ['html { -webkit-text-size-adjust: 100%; }', 'html { -webkit-text-size-adjust: 100%; height: 100%; }'],
];
let embedded = fragment;
for (const [from, to] of swaps) {
  if (!embedded.includes(from)) throw new Error('build: expected to find ' + from);
  embedded = embedded.replace(from, to);
}

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/boop.html', root), html);
await writeFile(new URL('dist/artifact.html', root), embedded);
console.log(`dist/boop.html  ${(html.length / 1024).toFixed(1)} KB`);
