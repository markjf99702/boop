// The fact book: every dog you've met and every fact you've found, with where each one comes from.

import { drawDog } from './dog.js';
import { TOPICS, counts } from './deck.js';

const dialog = document.getElementById('book');
const body = document.getElementById('bookBody');
document.getElementById('closeBook').addEventListener('click', () => dialog.close());
// A tap on the dimmed backdrop closes it too.
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const thumbs = new Map();

function thumb(breed) {
  if (!thumbs.has(breed.id)) {
    // The same drawing, cropped to the head.
    const svg = drawDog(breed, { uid: 'bk-' + breed.id })
      .replace(/viewBox="[^"]*"/, 'viewBox="70 45 260 260"')
      .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')
      .replace(/ tabindex="0" role="button" aria-label="Boop the nose"/, '');
    thumbs.set(breed.id, svg);
  }
  return thumbs.get(breed.id);
}

export function openBook({ facts, breeds, progress, onDog, onReset }) {
  const seen = new Set(progress.seen);
  const met = new Set(progress.met);
  const c = counts(facts, progress);
  const pct = c.total ? Math.round(c.found / c.total * 100) : 0;
  let html = `<div class="progress"><p><b>${c.found}</b> of ${c.total} facts found${c.found === c.total ? '. That’s all of them.' : ''}</p><div class="meter"><i style="width:${pct}%"></i></div></div>`;

  html += `<h3>Dogs you’ve booped <small>${met.size} of ${breeds.length}</small></h3><div class="dogs">`;
  for (const b of breeds) {
    const known = met.has(b.id);
    html += `<button type="button" data-dog="${b.id}"${known ? '' : ' disabled'} aria-label="${known ? esc(b.name) : 'Not booped yet'}"><span class="pic" style="background:${b.bg}">${thumb(b)}</span><span>${known ? esc(b.name) : '?'}</span></button>`;
  }
  html += '</div>';

  const byName = Object.fromEntries(breeds.map(b => [b.id, b]));
  for (const t of TOPICS) {
    const all = facts.filter(f => f.topic === t.id);
    if (!all.length) continue;
    const found = all.filter(f => seen.has(f.id));
    html += `<section style="--topic:var(--${t.id})"><h3>${t.label} <small>${found.length} of ${all.length}</small></h3><ul class="facts">`;
    for (const f of found) {
      const who = f.topic === 'breed' ? `<span class="who">${esc(byName[f.breed]?.name || '')}.</span> ` : '';
      html += `<li><p class="t">${who}${esc(f.text)}</p><p class="s">Source: <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a></p></li>`;
    }
    const left = all.length - found.length;
    if (left) {
      const how = t.id === 'breed' ? 'Boop more dogs to find them.' : 'Keep booping to find them.';
      html += `<li class="missing">${left === all.length ? `${left} to find.` : `${left} more to find.`} ${how}</li>`;
    }
    html += '</ul></section>';
  }

  html += `<p class="about">Every fact here was checked against the source it links to. If you spot one that’s wrong, the sources are the place to start.</p>`;
  html += `<button class="reset" type="button" id="resetBook">Start over</button>`;
  body.innerHTML = html;

  body.querySelectorAll('[data-dog]:not([disabled])').forEach(btn => btn.addEventListener('click', () => {
    dialog.close();
    onDog(btn.dataset.dog);
  }));
  // Two taps to start over, so one stray tap can't wipe everything.
  const reset = body.querySelector('#resetBook');
  reset.addEventListener('click', () => {
    if (reset.dataset.armed) {
      onReset();
      dialog.close();
      return;
    }
    reset.dataset.armed = '1';
    reset.textContent = 'Tap again to forget every fact and dog';
    setTimeout(() => { delete reset.dataset.armed; reset.textContent = 'Start over'; }, 4000);
  });

  if (!dialog.open) dialog.showModal();
  dialog.querySelector('.book-inner').scrollTop = 0;
}
