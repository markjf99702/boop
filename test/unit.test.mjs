// The facts, the fact picker and the drawings, without a browser:  node --test test/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTS } from '../js/facts.js';
import { BREEDS } from '../js/breeds.js';
import { TOPICS, FIRST_FACT, emptyProgress, tidy, nextFact, record, dogQueue, counts } from '../js/deck.js';
import { drawDog } from '../js/dog.js';
import { DogMotion } from '../js/motion.js';
import { mutt } from '../js/mutt.js';
import { seeded } from '../js/geom.js';

test('every fact is well formed', () => {
  const ids = new Set();
  const topics = new Set(TOPICS.map(t => t.id));
  const breeds = new Set(BREEDS.map(b => b.id));
  for (const f of FACTS) {
    assert.ok(/^[a-z0-9-]+$/.test(f.id), `bad id ${f.id}`);
    assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
    ids.add(f.id);
    assert.ok(topics.has(f.topic), `${f.id}: unknown topic ${f.topic}`);
    assert.ok(f.text.length > 40 && f.text.split(/\s+/).length <= 60, `${f.id}: text length`);
    assert.ok(f.source && f.source.length < 90, `${f.id}: source title`);
    assert.ok(/^https:\/\/\S+$/.test(f.url), `${f.id}: url`);
    assert.ok(!/!/.test(f.text), `${f.id}: no exclamation marks`);
    if (f.topic === 'breed') assert.ok(breeds.has(f.breed), `${f.id}: unknown breed ${f.breed}`);
    else assert.equal(f.breed, undefined, `${f.id}: breed on a non-breed fact`);
  }
  assert.ok(ids.has(FIRST_FACT), 'the first fact is missing');
});

test('every breed has at least one fact, and every topic has facts', () => {
  for (const b of BREEDS) assert.ok(FACTS.some(f => f.breed === b.id), `no fact for ${b.id}`);
  for (const t of TOPICS) assert.ok(FACTS.some(f => f.topic === t.id), `no facts about ${t.id}`);
});

test('the first boop ever is the nose print', () => {
  const { fact, isNew } = nextFact(FACTS, emptyProgress(), { breed: 'lab', onDog: 0 });
  assert.equal(fact.id, FIRST_FACT);
  assert.equal(isNew, true);
});

test('a new dog starts with its own breed, then mixes in other topics', () => {
  let p = record(emptyProgress(), FACTS.find(f => f.id === FIRST_FACT), 'beagle');
  const rand = seeded(3);
  const first = nextFact(FACTS, p, { breed: 'husky', onDog: 0, rand }).fact;
  assert.equal(first.breed, 'husky');
  p = record(p, first, 'husky');
  const second = nextFact(FACTS, p, { breed: 'husky', onDog: 1, lastTopic: 'breed', rand }).fact;
  assert.notEqual(second.topic, 'breed');
});

test('no repeats until everything has been seen, and no topic twice in a row while there is a choice', () => {
  let p = emptyProgress();
  const rand = seeded(11);
  const ids = [];
  let last = null;
  const breeds = BREEDS.map(b => b.id);
  let repeatsOfTopic = 0;
  for (let i = 0; i < FACTS.length * 4 && p.seen.length < FACTS.length; i++) {
    const breed = breeds[Math.floor(i / 5) % breeds.length];
    const { fact, isNew } = nextFact(FACTS, p, { breed, onDog: i % 5, lastTopic: last, rand });
    if (!isNew) continue; // everything general is found; this dog's own facts are too
    if (last && fact.topic === last && fact.topic !== 'breed') repeatsOfTopic++;
    ids.push(fact.id);
    p = record(p, fact, breed);
    last = fact.topic;
  }
  assert.equal(new Set(ids).size, ids.length, 'a fact came up twice');
  assert.equal(p.seen.length, FACTS.length, 'some facts never came up');
  assert.ok(repeatsOfTopic < 6, `same topic twice in a row ${repeatsOfTopic} times`);
});

test('once everything is seen, repeats avoid the recent ones and other breeds', () => {
  const p = { seen: FACTS.map(f => f.id), met: [], boops: 0 };
  const recent = FACTS.slice(0, 10).map(f => f.id);
  for (let i = 0; i < 50; i++) {
    const { fact, isNew } = nextFact(FACTS, p, { breed: 'pug', recent, rand: seeded(i) });
    assert.equal(isNew, false);
    assert.ok(!recent.includes(fact.id));
    assert.ok(fact.topic !== 'breed' || fact.breed === 'pug');
  }
});

test('dogs you have not met come first, starting with the beagle', () => {
  const q = dogQueue(BREEDS, { seen: [], met: ['lab', 'pug'], boops: 0 }, { first: 'beagle', rand: seeded(2) });
  assert.equal(q[0], 'beagle');
  assert.deepEqual(q.slice(-2).sort(), ['lab', 'pug']);
  assert.equal(q.length, BREEDS.length);
  const q2 = dogQueue(BREEDS, emptyProgress(), { current: 'corgi', rand: seeded(2) });
  assert.ok(!q2.includes('corgi'));
});

test('saved progress is cleaned up', () => {
  const p = tidy({ seen: ['nose-print', 'nose-print', 'no-such-fact'], met: ['beagle', 'wolf'], boops: '12.7', sound: false }, FACTS, BREEDS);
  assert.deepEqual(p, { seen: ['nose-print'], met: ['beagle'], boops: 12 });
  assert.deepEqual(tidy('junk', FACTS, BREEDS), emptyProgress());
  // A list that isn't a list (hand-edited or damaged storage) is dropped, not left to stop the app from starting.
  for (const junk of [{ seen: 'nose-print' }, { seen: {} }, { met: 5 }, { seen: null, met: null }]) {
    assert.deepEqual(tidy(junk, FACTS, BREEDS), emptyProgress(), JSON.stringify(junk));
  }
  assert.deepEqual(tidy({ seen: ['nose-print'], met: 'beagle', boops: 3 }, FACTS, BREEDS), { seen: ['nose-print'], met: [], boops: 3 });
  const c = counts(FACTS, p);
  assert.equal(c.found, 1);
  assert.equal(c.total, FACTS.length);
  assert.equal(c.by.nose.found, 1);
});

// A dog's reactions on a pretend clock. DogMotion only needs to find its parts in the drawing and read a few
// numbers off them, so a stand-in will do, and its later() queues work for run() instead of waiting for real.
function motionOnAClock(spec) {
  const part = () => ({ dataset: { y: '0' }, classList: { contains: () => false }, getAttribute: () => null, setAttribute() {}, querySelector: () => null });
  const m = new DogMotion({ querySelector: part, querySelectorAll: () => [] }, spec);
  let now = 0;
  const due = [];
  m.later = (ms, fn) => { due.push({ at: now + ms, fn }); };
  const run = ms => {
    const end = now + ms;
    for (;;) {
      due.sort((a, b) => a.at - b.at);
      if (!due.length || due[0].at > end) break;
      const next = due.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { m, run };
}

test('a lick in the middle of a blep or a pant leaves the tongue where it belongs', () => {
  // A blep, then a lick that ends after the blep is over: the tongue goes back in.
  let { m, run } = motionOnAClock({});
  m.react('blep');
  run(1600);
  m.react('lick');
  run(5000);
  assert.equal(m.s.tongue.to, 0, 'a blep then a lick left the tongue out');

  // A pant, then a lick that ends after the pant is over: the mouth closes with the tongue in.
  ({ m, run } = motionOnAClock({}));
  m.react('pant');
  run(2000);
  m.react('lick');
  run(5000);
  assert.equal(m.s.tongue.to, 0, 'a pant then a lick left the tongue out');
  assert.equal(m.s.jaw.to, 0);

  // A lick that ends while the blep is still going puts the tongue back out until the blep is over.
  ({ m, run } = motionOnAClock({}));
  m.react('blep');
  run(200);
  m.react('lick');
  run(900);
  assert.equal(m.s.tongue.to, 0.42);
  run(2000);
  assert.equal(m.s.tongue.to, 0);

  // A dog that always pants has its tongue out again after two quick licks.
  ({ m, run } = motionOnAClock({ pant: true }));
  m.react('lick');
  run(300);
  m.react('lick');
  run(3000);
  assert.equal(m.s.tongue.to, 1, 'two quick licks left a panting dog with its tongue in');
});

test('every dog draws, including many mixed breeds', () => {
  for (const b of BREEDS) {
    const svg = drawDog(b, { uid: b.id });
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${b.id} has NaN or undefined in it`);
    assert.ok(svg.includes('class="nose"'), `${b.id} has no nose`);
  }
  const base = BREEDS.find(b => b.id === 'mutt');
  for (let i = 0; i < 60; i++) {
    const svg = drawDog(mutt(base, seeded(i)), { uid: 'm' + i });
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `mutt ${i} has NaN or undefined in it`);
  }
});
