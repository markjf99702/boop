// Which fact comes next, and what you've found so far. No DOM here, so the tests can run it directly.

export const TOPICS = [
  { id: 'nose', label: 'The nose' },
  { id: 'senses', label: 'Senses' },
  { id: 'mind', label: 'Mind' },
  { id: 'body', label: 'Body' },
  { id: 'history', label: 'History' },
  { id: 'myth', label: 'Myths' },
  { id: 'breed', label: 'Breeds' },
];

export const FIRST_FACT = 'nose-print';

export function emptyProgress() {
  return { seen: [], met: [], boops: 0 };
}

// Clean up whatever came out of storage: unknown ids are dropped, duplicates removed.
export function tidy(saved, facts, breeds) {
  const p = emptyProgress();
  if (!saved || typeof saved !== 'object') return p;
  const factIds = new Set(facts.map(f => f.id));
  const breedIds = new Set(breeds.map(b => b.id));
  p.seen = [...new Set((saved.seen || []).filter(id => factIds.has(id)))];
  p.met = [...new Set((saved.met || []).filter(id => breedIds.has(id)))];
  p.boops = Math.max(0, Math.floor(+saved.boops || 0));
  return p;
}

// The fact for this boop. onDog counts earlier boops on the dog in front of you.
// Order of preference:
//   the very first boop ever gets the nose-print fact (you just touched one);
//   a dog's own breed facts come first while it's new to you, then every third boop;
//   otherwise a fact you haven't seen, from a different topic than last time;
//   then any unseen facts about this breed;
//   and once everything's been seen, a repeat that isn't one of the last few.
export function nextFact(facts, progress, { breed, onDog = 0, lastTopic = null, recent = [], rand = Math.random } = {}) {
  const seen = new Set(progress.seen);
  const unseen = facts.filter(f => !seen.has(f.id));
  const first = facts.find(f => f.id === FIRST_FACT);
  if (progress.seen.length === 0 && first) return { fact: first, isNew: true };

  const mine = unseen.filter(f => f.topic === 'breed' && f.breed === breed);
  const knownMine = facts.some(f => f.topic === 'breed' && f.breed === breed && seen.has(f.id));
  if (mine.length && (!knownMine || (onDog % 3 === 2 && lastTopic !== 'breed'))) return { fact: mine[0], isNew: true };

  const general = unseen.filter(f => f.topic !== 'breed');
  if (general.length) {
    const fresh = general.filter(f => f.topic !== lastTopic);
    const pool = fresh.length ? fresh : general;
    return { fact: pool[Math.floor(rand() * pool.length)], isNew: true };
  }
  if (mine.length) return { fact: mine[0], isNew: true };

  const avoid = new Set(recent);
  const repeats = facts.filter(f => (f.topic !== 'breed' || f.breed === breed) && !avoid.has(f.id));
  const pool = repeats.length ? repeats : facts;
  return { fact: pool[Math.floor(rand() * pool.length)], isNew: false };
}

export function record(progress, fact, breed) {
  const p = { ...progress, seen: [...progress.seen], met: [...progress.met] };
  if (fact && !p.seen.includes(fact.id)) p.seen.push(fact.id);
  if (breed && !p.met.includes(breed)) p.met.push(breed);
  p.boops += 1;
  return p;
}

// The order dogs come in: dogs you haven't met first, shuffled, then everyone else, never the same dog twice in a row.
export function dogQueue(breeds, progress, { current = null, first = null, rand = Math.random } = {}) {
  const met = new Set(progress.met);
  const shuffle = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const ids = breeds.map(b => b.id).filter(id => id !== current);
  let unmet = shuffle(ids.filter(id => !met.has(id)));
  if (first && unmet.includes(first)) unmet = [first, ...unmet.filter(id => id !== first)];
  return [...unmet, ...shuffle(ids.filter(id => met.has(id)))];
}

export function counts(facts, progress) {
  const seen = new Set(progress.seen);
  const by = {};
  for (const t of TOPICS) by[t.id] = { found: 0, total: 0 };
  for (const f of facts) {
    const c = by[f.topic] || (by[f.topic] = { found: 0, total: 0 });
    c.total++;
    if (seen.has(f.id)) c.found++;
  }
  return { found: facts.filter(f => seen.has(f.id)).length, total: facts.length, by };
}
