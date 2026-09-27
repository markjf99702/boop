// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// Math.random is seeded, so the same pictures come out every time.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const SEED = 4;
const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

// Flat illustrations compress well to 256 colours.
async function save(shot, path) {
  const img = UPNG.decode(shot);
  await writeFile(join(root, path), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
}

async function open(viewport, deviceScaleFactor, progress) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(([seed, saved]) => {
    let a = seed; // mulberry32
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    if (saved) localStorage.setItem('boop.v1', JSON.stringify(saved));
  }, [SEED, progress]);
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return page;
}

// Show a dog with a fact on the card, mid-boop: eyes squeezed shut, tongue out.
async function pose(page, dog, fact, { squint = true, react = 'blep', look = [200, 190] } = {}) {
  await page.evaluate(([dog, fact, squint, react, look]) => {
    window.boop.show(dog);
    window.boop.fact(fact);
    const m = window.boop.dog.motion;
    m.look(...look);
    if (squint) m.squint(60000);
    if (react) m.react(react);
    m.nextBlink = Infinity;
  }, [dog, fact, squint, react, look]);
  await page.waitForTimeout(700);
}

const { FACTS } = await import(new URL('../js/facts.js', import.meta.url));
const { BREEDS } = await import(new URL('../js/breeds.js', import.meta.url));
const pickFacts = (n, skip = 3) => FACTS.filter((f, i) => i % skip === 0).slice(0, n).map(f => f.id);
const sample = { seen: pickFacts(34), met: ['beagle', 'corgi', 'husky', 'pug', 'dalmatian', 'poodle', 'chihuahua', 'lab', 'bloodhound'], boops: 60 };
const has = id => FACTS.some(f => f.id === id);
const factFor = (...ids) => ids.find(has) || FACTS[0].id;

// Phone screenshots for the README.
{
  const page = await open({ width: 390, height: 844 }, 2, sample);
  await pose(page, 'corgi', factFor('receptors', 'nose-print'));
  await save(await page.screenshot(), 'docs/phone-boop.png');
  await pose(page, 'husky', factFor('dog-years', 'black-white'), { squint: false, react: null, look: [150, 330] });
  await save(await page.screenshot(), 'docs/phone-myth.png');
  await page.click('#bookBtn');
  await page.waitForTimeout(300);
  await save(await page.screenshot(), 'docs/phone-book.png');
  await page.context().close();
}

// Link preview, 1200 x 630: the name and one line on the left, three of the app's dogs on the right.
{
  const page = await open({ width: 1200, height: 630 }, 1);
  const fonts = {};
  for (const f of ['fredoka', 'fraunces']) fonts[f] = (await readFile(join(root, `fonts/${f}.woff2`))).toString('base64');
  const icon = await readFile(join(root, 'icon.svg'), 'utf8');
  const dogs = await page.evaluate(async () => {
    const { drawDog } = await import('./js/dog.js');
    const { byId } = await import('./js/breeds.js');
    return ['pug', 'beagle', 'husky'].map(id => drawDog(byId[id], { uid: 'og' + id }));
  });
  await page.setContent(`<style>
    @font-face { font-family: Fredoka; src: url(data:font/woff2;base64,${fonts.fredoka}); font-weight: 300 700; }
    @font-face { font-family: Fraunces; src: url(data:font/woff2;base64,${fonts.fraunces}); font-weight: 400 600; }
    body { margin: 0; }
    .og { width: 1200px; height: 630px; position: relative; overflow: hidden; background: #cfe2cf radial-gradient(ellipse 60% 70% at 72% 90%, #e6f0e6, transparent); font-family: Fredoka; color: #2b211c; }
    .text { position: absolute; left: 72px; top: 118px; width: 450px; }
    .text svg { width: 84px; height: 84px; display: block; margin-bottom: 26px; }
    h1 { margin: 0; font-size: 132px; line-height: .9; font-weight: 600; letter-spacing: -.02em; }
    p { margin: 26px 0 0; font: 400 34px/1.3 Fraunces; color: #45382f; }
    .dog { position: absolute; bottom: -60px; }
    .dog svg { display: block; width: 100%; height: auto; }
    .d0 { width: 400px; left: 520px; bottom: -30px; }
    .d2 { width: 400px; left: 865px; bottom: -30px; }
    .d1 { width: 500px; left: 650px; bottom: -58px; }
    .word { position: absolute; left: 950px; top: 330px; font: 700 46px Fredoka; color: #fff; -webkit-text-stroke: 10px #2b211c; paint-order: stroke fill; transform: rotate(-10deg); }
  </style>
  <div class="og">
    <div class="text">${icon}<h1>Boop</h1><p>Boop a dog on the nose. Every boop turns up something true about dogs.</p></div>
    <div class="dog d0">${dogs[0]}</div><div class="dog d2">${dogs[2]}</div><div class="dog d1">${dogs[1]}</div>
    <div class="word">boop</div>
  </div>`);
  // The middle dog has just been booped.
  await page.evaluate(() => {
    const beagle = document.querySelector('.d1 svg');
    beagle.querySelectorAll('.eye-open').forEach(e => e.setAttribute('visibility', 'hidden'));
    beagle.querySelectorAll('.eye-shut').forEach(e => e.setAttribute('visibility', 'visible'));
    const t = beagle.querySelector('.tongue');
    t.setAttribute('transform', t.getAttribute('transform').replace(/scale\(1 [^)]*\)/, 'scale(1 .45)'));
    for (const [sel, look] of [['.d0 svg', 1], ['.d2 svg', -1]]) {
      const svg = document.querySelector(sel);
      svg.querySelectorAll('.iris').forEach(i => i.setAttribute('transform', `translate(${look * 2.6} 0)`));
    }
  });
  await page.evaluate(() => document.fonts.ready);
  await save(await page.locator('.og').screenshot(), 'og.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
