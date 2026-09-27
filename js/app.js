// Boop: tap a dog's nose, learn something true about dogs.

import { BREEDS, byId } from './breeds.js';
import { drawDog, VIEW } from './dog.js';
import { DogMotion } from './motion.js';
import { FACTS } from './facts.js';
import { TOPICS, emptyProgress, tidy, nextFact, record, dogQueue, counts } from './deck.js';
import { boopSound, sneezeSound, setSound, soundOn } from './sound.js';
import { mutt } from './mutt.js';
import { openBook } from './book.js';

const KEY = 'boop.v1';
const SITE = 'https://junkdrawer.works/boop/';
const FIRST_DOG = 'beagle';
const $ = id => document.getElementById(id);

// ---- saved progress
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
const saved = load() || {};
let progress = tidy(saved, FACTS, BREEDS);
setSound(saved.sound !== false);
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...progress, sound: soundOn() })); } catch { /* private mode: progress lasts this visit only */ }
}

// ---- state
let queue = dogQueue(BREEDS, progress, { first: FIRST_DOG });
let dog = null;        // { spec, svg, motion, boops }
let lastTopic = null;
let recent = [];
let lastFactAt = 0;
let current = null;    // the fact on the card

const wrap = $('dogWrap');
const card = $('card');

// ---- dogs
function showDog(id, { instant = false } = {}) {
  const base = byId[id];
  const spec = id === 'mutt' ? mutt(base) : base;
  const svgMarkup = drawDog(spec, { uid: 'd' + Date.now().toString(36), title: spec.name });
  const holder = document.createElement('div');
  holder.innerHTML = svgMarkup;
  const svg = holder.firstElementChild;
  addRing(svg);

  const old = dog;
  if (old) {
    old.motion.destroy();
    old.svg.classList.add('leaving');
    setTimeout(() => old.svg.remove(), 300);
  }
  if (!instant) svg.classList.add('arriving');
  wrap.append(svg);
  if (!instant) requestAnimationFrame(() => requestAnimationFrame(() => { svg.classList.add('arrived'); svg.classList.remove('arriving'); }));

  const motion = new DogMotion(svg, spec);
  motion.onSneeze = () => sneezeSound(pitchFor(spec));
  dog = { id, spec, svg, motion, boops: 0 };

  document.documentElement.style.setProperty('--dogbg', spec.bg);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(spec.bg));
  $('breed').textContent = spec.name;
  svg.querySelector('.nose').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); boop(null); }
  });
}

// The pulsing ring round the nose, until the first boop.
function addRing(svg) {
  if (progress.boops > 0) return;
  const nose = svg.querySelector('.nose');
  const hit = nose.querySelector('.hit');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('class', 'ring');
  ring.setAttribute('cy', hit.getAttribute('cy'));
  ring.setAttribute('r', (+hit.getAttribute('r') * 0.75).toFixed(1));
  nose.append(ring);
}

function themeColor(bg) {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  if (!dark) return bg;
  const n = parseInt(bg.slice(1), 16), k = 0.3;
  const m = (s, d) => Math.round(((n >> s) & 255) * k + d * (1 - k));
  return '#' + ((1 << 24) | (m(16, 0x14) << 16) | (m(8, 0x10) << 8) | m(0, 0x0e)).toString(16).slice(1);
}

const pitchFor = spec => Math.max(0.8, Math.min(1.4, 150 / (spec.body?.w || 150)));

function nextDog() {
  if (!queue.length) queue = dogQueue(BREEDS, progress, { current: dog?.id });
  let id = queue.shift();
  if (id === dog?.id && queue.length) id = queue.shift();
  showDog(id);
}

// ---- booping
function boop(point) {
  const now = performance.now();
  dog.motion.boop();
  boopSound(pitchFor(dog.spec));
  navigator.vibrate?.(12);
  if (point) floatWord(point, 'boop');
  if (progress.boops === 0) wrap.querySelectorAll('.ring').forEach(r => r.remove());

  // Rapid boops still squish the nose, but the fact changes at most every 0.7 s so there's time to read it.
  if (now - lastFactAt < 700) return;
  lastFactAt = now;
  const { fact, isNew } = nextFact(FACTS, progress, { breed: dog.id, onDog: dog.boops, lastTopic, recent });
  dog.boops++;
  progress = record(progress, fact, dog.id);
  save();
  lastTopic = fact.topic;
  recent = [fact.id, ...recent].slice(0, 12);
  showFact(fact, isNew);
  updateCount(isNew);
}

function floatWord([x, y], text) {
  const el = document.createElement('span');
  el.className = 'boopword';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.append(el);
  setTimeout(() => el.remove(), 950);
}

function topicLabel(fact) {
  if (fact.topic === 'breed') return byId[fact.breed]?.plural || 'Breeds';
  return TOPICS.find(t => t.id === fact.topic)?.label || fact.topic;
}

function showFact(fact, isNew) {
  current = fact;
  card.style.setProperty('--topic', `var(--${fact.topic})`);
  $('topic').textContent = topicLabel(fact);
  $('badge').hidden = !isNew;
  const f = $('fact');
  f.classList.remove('intro');
  f.textContent = fact.text;
  const meta = $('meta');
  meta.textContent = '';
  const src = document.createElement('a');
  src.className = 'src';
  src.href = fact.url;
  src.target = '_blank';
  src.rel = 'noopener';
  src.textContent = 'Source: ' + fact.source;
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'share';
  share.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 12v6.5c0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5V12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share</span>';
  share.addEventListener('click', () => shareFact(fact, share));
  meta.append(src, share);
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
}

async function shareFact(fact, btn) {
  const text = `${fact.text}\n\nFound by booping a dog on the nose:`;
  const label = btn.querySelector('span');
  if (navigator.share) {
    try { await navigator.share({ title: 'Boop', text, url: SITE }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${SITE}`);
    label.textContent = 'Copied';
  } catch {
    label.textContent = 'Couldn’t copy';
  }
  setTimeout(() => { label.textContent = 'Share'; }, 1800);
}

function updateCount(bump) {
  const c = counts(FACTS, progress);
  $('foundCount').textContent = c.found;
  $('totalCount').textContent = c.total;
  $('bookBtn').setAttribute('aria-label', `Fact book: ${c.found} of ${c.total} facts found`);
  if (bump) {
    const b = $('bookBtn');
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }
}

// ---- pointer: the dog watches your finger, and a tap on the nose is a boop
function toSvg(e) {
  const r = wrap.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * VIEW.w, (e.clientY - r.top) / r.height * VIEW.h];
}
document.addEventListener('pointermove', e => { if (dog) dog.motion.look(...toSvg(e)); });
wrap.addEventListener('pointerdown', e => {
  if (!dog || e.button > 0) return;
  dog.motion.look(...toSvg(e));
  const onNose = e.target.closest?.('.nose');
  if (onNose) {
    e.preventDefault();
    boop([e.clientX, e.clientY]);
    return;
  }
  const onHead = e.target.closest?.('.head');
  if (onHead) {
    const [x] = toSvg(e);
    dog.motion.pat(x < 200 ? -1 : 1);
    if (progress.boops === 0) hint('That’s a pat. Try the nose.');
  }
});

function hint(text) {
  const h = $('hint');
  if (h) h.textContent = text;
}

// ---- buttons and keys
$('nextBtn').addEventListener('click', nextDog);
$('soundBtn').addEventListener('click', () => {
  setSound(!soundOn());
  $('soundBtn').setAttribute('aria-pressed', String(soundOn()));
  save();
});
$('soundBtn').setAttribute('aria-pressed', String(soundOn()));
$('bookBtn').addEventListener('click', () => openBook({
  facts: FACTS, breeds: BREEDS, progress,
  onDog: id => showDog(id),
  onReset: () => {
    progress = emptyProgress();
    save();
    queue = dogQueue(BREEDS, progress, { current: dog?.id });
    updateCount(false);
  },
}));
document.addEventListener('keydown', e => {
  if (e.target.closest?.('dialog, input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'b' || e.key === 'B') boop(null);
  if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') nextDog();
});

// ---- go
function frame(now) {
  if (dog) dog.motion.update(now);
  requestAnimationFrame(frame);
}
nextDog();
updateCount(false);
requestAnimationFrame(frame);

// For the screenshot and test scripts.
window.boop = {
  boop: () => boop(null),
  show: id => showDog(id, { instant: true }),
  fact: (id, isNew = true) => showFact(FACTS.find(f => f.id === id), isNew),
  get dog() { return dog; },
  get progress() { return progress; },
};

if ('serviceWorker' in navigator && !document.documentElement.hasAttribute('data-single') && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
