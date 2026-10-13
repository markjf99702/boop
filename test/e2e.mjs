// Uses the app in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
// Skeleton from the junkdrawer skill: the checks at the bottom are the ones every project wants;
// add the ones that prove this app does its job.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
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

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
page.on('request', r => { if (!r.url().startsWith(base)) problems.push('left the site: ' + r.url()); });

await page.goto(base);
await page.evaluate(() => document.fonts.ready);
const { FACTS } = await import(new URL('../js/facts.js', import.meta.url));
const tapNose = async () => {
  const box = await page.locator('.dog-wrap svg:last-child .nose .hit').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
const found = () => page.textContent('#foundCount').then(Number);

// The first dog is a beagle, and the card asks for a boop.
await page.waitForTimeout(700);
assert.equal(await page.textContent('#breed'), 'Beagle');
assert.match(await page.textContent('#fact'), /Boop the nose/);
assert.equal(await page.textContent('#totalCount'), String(FACTS.length));

// A tap on the head is a pat, not a boop.
const head = await page.locator('.dog-wrap svg:last-child .skull').boundingBox();
await page.touchscreen.tap(head.x + head.width / 2, head.y + 12);
assert.equal(await found(), 0, 'a pat on the head counted as a boop');

// First boop: the nose-print fact, with its source.
await tapNose();
assert.equal(await found(), 1);
const first = FACTS.find(f => f.id === 'nose-print');
assert.equal(await page.textContent('#fact'), first.text);
assert.equal(await page.getAttribute('#meta a.src', 'href'), first.url);
assert.equal(await page.isVisible('#badge'), true, 'no New badge on a new fact');

// Boops closer together than 0.7 s squish the nose but don't skip facts.
await tapNose();
assert.equal(await found(), 1, 'a rapid second boop changed the fact');

// The next one is about beagles: a dog's own breed comes first while it's new to you.
await page.waitForTimeout(800);
await tapNose();
assert.equal(await found(), 2);
const second = await page.textContent('#fact');
assert.equal(FACTS.find(f => f.text === second)?.breed, 'beagle');

// A new dog: its first boop is about its breed.
await page.click('#nextBtn');
await page.waitForTimeout(700);
const breedName = await page.textContent('#breed');
assert.notEqual(breedName, 'Beagle');
const id = await page.evaluate(() => window.boop.dog.id);
await tapNose();
const shown = await page.textContent('#fact');
const fact = FACTS.find(f => f.text === shown);
assert.ok(fact, 'the card shows a fact that is not in facts.js');
assert.equal(fact.breed, id, 'the first boop on a new dog was not about its breed');
assert.equal(await found(), 3);

// Every boop from here turns up something new until they run out.
for (let i = 0; i < 6; i++) { await page.waitForTimeout(720); await tapNose(); }
assert.equal(await found(), 9);
const seen = await page.evaluate(() => window.boop.progress.seen);
assert.equal(new Set(seen).size, seen.length, 'a fact came up twice');

// Keyboard: the nose is a button.
await page.waitForTimeout(720);
await page.focus('.dog-wrap svg:last-child .nose');
await page.keyboard.press('Enter');
assert.equal(await found(), 10);

// The fact book lists what was found and the two dogs booped.
await page.click('#bookBtn');
assert.equal(await page.isVisible('#book'), true);
assert.match(await page.textContent('#book .progress'), /10 of \d+ facts found/);
assert.equal(await page.locator('#book .dogs button:not([disabled])').count(), 2);
assert.equal(await page.locator('#book .facts li:not(.missing)').count(), 10);
// Pick the beagle from the book to go back to it.
await page.click('#book .dogs button[data-dog="beagle"]');
assert.equal(await page.isVisible('#book'), false);
await page.waitForTimeout(600);
assert.equal(await page.textContent('#breed'), 'Beagle');

// Progress survives a reload.
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await found(), 10, 'progress was lost on reload');

// Start over forgets everything and puts the card back the way it starts, with the ring round the nose.
await page.waitForTimeout(700);
await tapNose();
assert.equal(await found(), 11);
await page.click('#bookBtn');
await page.click('#resetBook');
await page.click('#resetBook');
assert.equal(await page.isVisible('#book'), false);
assert.equal(await found(), 0);
assert.deepEqual(await page.evaluate(() => ({
  topic: document.getElementById('topic').textContent,
  badgeHidden: document.getElementById('badge').hidden,
  fact: document.getElementById('fact').textContent,
  intro: document.getElementById('fact').classList.contains('intro'),
  hint: document.getElementById('hint')?.textContent,
  rings: document.querySelectorAll('.dog-wrap svg:last-child .nose .ring').length,
})), { topic: '', badgeHidden: true, fact: 'Boop the nose.', intro: true, hint: 'Every boop turns up something true about dogs.', rings: 1 }, 'Start over left the last fact on the card');
// And the next boop is the first one again.
await page.waitForTimeout(720);
await tapNose();
assert.equal(await page.textContent('#fact'), first.text);
assert.equal(await found(), 1);

// Every dog draws, including a few different mixed breeds.
const names = await page.evaluate(async () => {
  const { BREEDS } = await import('./js/breeds.js');
  const out = [];
  for (const b of BREEDS) for (let k = 0; k < (b.id === 'mutt' ? 5 : 1); k++) {
    window.boop.show(b.id);
    const svg = document.querySelector('.dog-wrap svg:last-child');
    if (svg.outerHTML.includes('NaN')) out.push('NaN in ' + b.id);
    if (!svg.querySelector('.nose .hit')) out.push('no nose on ' + b.id);
  }
  return out;
});
assert.deepEqual(names, []);

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.ok(await page.title(), 'the page did not load offline');
await ctx.setOffline(false);

// On a phone the first boop makes a sound. A phone only lets a page start sound once a tap ends, and the boop
// happens as the finger lands, so the sound has to be woken when the tap ends. This browser plays sound without
// asking, so the AudioContext here follows a phone's rule instead. Nothing may run in the page before the tap,
// because Playwright counts that as a tap: the page says where the nose is once the dog is up.
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await phone.addInitScript(() => {
    window.AudioContext = class extends window.AudioContext {
      #allowed = navigator.userActivation.hasBeenActive;
      constructor(...args) { super(...args); window.sound = this; }
      get state() { return this.#allowed ? 'running' : 'suspended'; }
      resume() { if (navigator.userActivation.hasBeenActive) this.#allowed = true; return super.resume(); }
    };
    addEventListener('click', () => { window.soundAfterTap = window.sound?.state || 'none'; }, { capture: true, once: true });
    document.addEventListener('transitionend', e => {
      if (!e.target.matches?.('.dog-wrap svg.arrived')) return;
      const r = e.target.querySelector('.nose .hit').getBoundingClientRect();
      console.log(`nose at ${r.x + r.width / 2} ${r.y + r.height / 2}`);
    }, true);
  });
  const p = await phone.newPage();
  p.on('pageerror', e => problems.push(e.message));
  const nose = p.waitForEvent('console', { predicate: m => m.text().startsWith('nose at'), timeout: 20000 });
  await p.goto(base);
  const [x, y] = (await nose).text().split(' ').slice(2).map(Number);
  await p.touchscreen.tap(x, y);
  await p.waitForFunction(() => window.soundAfterTap, null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => window.soundAfterTap), 'running', 'the first boop on a phone made no sound');
  await phone.close();
}

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
