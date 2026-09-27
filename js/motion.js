// Makes a drawn dog move: breathing, blinking, looking at your finger, and reacting to boops.
// Every moving part is a spring, so reactions stack and settle on their own.

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

class Spring {
  constructor(x, k = 170, d = 13) { this.x = x; this.v = 0; this.to = x; this.k = k; this.d = d; }
  step(dt) { this.v += (this.k * (this.to - this.x) - this.d * this.v) * dt; this.x += this.v * dt; }
}

const pick = (list, rand = Math.random) => list[Math.floor(rand() * list.length)];

export class DogMotion {
  constructor(svg, spec) {
    this.svg = svg;
    this.spec = spec;
    const q = s => svg.querySelector(s);
    const all = s => [...svg.querySelectorAll(s)];
    this.el = {
      head: q('.head'), skull: q('.skull'), face: q('.face'), eyes: q('.eyes'), brows: q('.brows'), muzzle: q('.muzzle'),
      nose: q('.nose'), earsBack: q('.ears-back'), earsFront: q('.ears-front'), body: q('.body'), tongue: q('.tongue'),
      lick: q('.lick'), mouthOpen: q('.mouth-open'), puffs: q('.puffs'), tag: q('.tag'), chin: q('.chin'),
      irises: all('.iris'), open: all('.eye-open'), shut: all('.eye-shut'), ears: all('.ear'),
    };
    this.noseY = +this.el.nose.dataset.y;
    this.tongueY = +this.el.tongue.dataset.y;
    this.lickY = +this.el.lick.dataset.y;
    this.lickX = +(this.el.muzzle.querySelector('circle')?.getAttribute('r') || 15) * 0.55;
    this.tagBase = this.el.tag?.getAttribute('transform') || '';
    this.chinY = +(this.el.chin?.getAttribute('cy') || 0);
    this.er = +(svg.querySelector('.iris circle')?.getAttribute('r') || 9);
    this.pant = !!spec.pant;
    this.s = {
      lx: new Spring(0, 60, 11), ly: new Spring(0, 60, 11),
      tilt: new Spring(0, 90, 9), dy: new Spring(0, 220, 14),
      sx: new Spring(1, 320, 9), sy: new Spring(1, 320, 9),
      earR: new Spring(0, 200, 8), earL: new Spring(0, 200, 8),
      tongue: new Spring(this.pant ? 1 : 0, 160, 16), lick: new Spring(0, 260, 20),
      puff: new Spring(0, 60, 12), tag: new Spring(0, 60, 2.5), jaw: new Spring(this.pant ? 1 : 0, 120, 14),
    };
    this.blink = 1;
    this.squintUntil = 0;
    this.nextBlink = performance.now() + 1500 + Math.random() * 2500;
    this.nextTwitch = performance.now() + 4000 + Math.random() * 5000;
    this.nextGlance = 0;
    this.pointerAt = 0;
    this.target = null;
    this.timers = [];
    this.t = 0;
    this.last = null;
    this.lastVariant = '';
    this.mouthShown = null;
  }

  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
  destroy() { this.timers.forEach(clearTimeout); this.timers = []; }

  // Where the pointer is, in the SVG's own units (the head is at 200, 200).
  look(x, y) {
    this.target = [Math.max(-1, Math.min(1, (x - 200) / 190)), Math.max(-1, Math.min(1, (y - 190) / 220))];
    this.pointerAt = performance.now();
  }

  squint(ms) { this.squintUntil = Math.max(this.squintUntil, performance.now() + ms); }

  // A boop on the nose. Returns the name of the extra reaction, for the tests.
  boop(rand = Math.random) {
    const s = this.s;
    s.sx.x = 1.22; s.sy.x = 0.74; s.sx.v = 0; s.sy.v = 0;
    s.dy.v -= 90;
    s.earR.v += 260; s.earL.v += 260;
    s.tag.v += 260 * (rand() < 0.5 ? -1 : 1);
    this.squint(560);
    const options = ['blep', 'lick', 'tilt', 'sneeze', 'shake', 'pant', 'none', 'blep', 'lick', 'tilt'];
    let v = pick(options, rand);
    if (v === this.lastVariant) v = pick(options, rand);
    if (this.pant && v === 'pant') v = 'lick';
    this.lastVariant = v;
    if (REDUCED && (v === 'shake' || v === 'sneeze')) v = 'blep';
    this.react(v);
    return v;
  }

  react(v) {
    const s = this.s;
    if (v === 'blep') {
      s.tongue.to = this.pant ? 1 : 0.42;
      this.later(2200, () => { s.tongue.to = this.pant ? 1 : 0; });
    } else if (v === 'lick') {
      const was = s.tongue.to;
      s.tongue.to = 0;
      this.later(260, () => { s.lick.to = 1; });
      this.later(560, () => { s.lick.to = 0; });
      this.later(800, () => { s.tongue.to = was; });
    } else if (v === 'tilt') {
      s.tilt.to = (Math.random() < 0.5 ? -1 : 1) * 11;
      this.later(1500, () => { s.tilt.to = 0; });
    } else if (v === 'sneeze') {
      this.later(420, () => {
        this.squint(420);
        s.dy.v += 260; s.sx.x = 1.15; s.sy.x = 0.8;
        s.puff.x = 1; s.puff.to = 0;
        s.earR.v -= 400; s.earL.v -= 400;
        this.onSneeze?.();
      });
    } else if (v === 'shake') {
      s.tilt.k = 260; s.tilt.d = 4; s.tilt.v += 420;
      s.earR.v += 700; s.earL.v -= 700;
      this.later(900, () => { s.tilt.k = 90; s.tilt.d = 9; });
    } else if (v === 'pant') {
      s.jaw.to = 1; s.tongue.to = 1;
      this.later(2600, () => { s.jaw.to = 0; s.tongue.to = 0; });
    }
  }

  // A tap on the head or ears, not the nose.
  pat(side) {
    const s = this.s;
    this.squint(900);
    s.earR.to = -14; s.earL.to = -14;
    s.tilt.to = side * 6;
    s.dy.v += 50;
    this.later(900, () => { s.earR.to = 0; s.earL.to = 0; s.tilt.to = 0; });
  }

  update(now) {
    if (this.last == null) this.last = now;
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const s = this.s;

    // Look at the pointer; after a while with no pointer, glance around now and then.
    if (this.target && now - this.pointerAt < 3500) {
      s.lx.to = this.target[0]; s.ly.to = this.target[1];
    } else if (now > this.nextGlance) {
      const r = Math.random();
      s.lx.to = r < 0.45 ? 0 : (Math.random() * 2 - 1) * 0.8;
      s.ly.to = r < 0.45 ? 0.05 : (Math.random() * 2 - 1) * 0.5;
      this.nextGlance = now + 1800 + Math.random() * 3000;
    }

    // Blink, sometimes twice.
    if (now > this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + (Math.random() < 0.2 ? 260 : 2200 + Math.random() * 3800);
    }
    const bt = this.blinkStart ? (now - this.blinkStart) / 150 : 2;
    this.blink = bt < 1 ? Math.max(0.08, Math.abs(1 - bt * 2)) : 1;

    // An ear twitch every so often.
    if (now > this.nextTwitch) {
      (Math.random() < 0.5 ? s.earR : s.earL).v += 380;
      this.nextTwitch = now + 4000 + Math.random() * 7000;
    }

    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < steps; i++) for (const k in s) s[k].step(dt / steps);

    const m = REDUCED ? 0.35 : 1;
    const lx = s.lx.x * m, ly = s.ly.x * m;
    const breathe = REDUCED ? 0 : Math.sin(this.t * 2.1) * 1.2;
    const f = n => Math.round(n * 100) / 100;
    const e = this.el;
    e.body.setAttribute('transform', `translate(0 ${f(breathe * 0.5)})`);
    e.head.setAttribute('transform', `translate(${f(lx * 3)} ${f(s.dy.x + breathe + ly * 2)}) rotate(${f(s.tilt.x + lx * 2.5)} 0 70)`);
    e.skull.setAttribute('transform', `translate(${f(lx * 1.5)} ${f(ly * 1.2)})`);
    e.earsBack.setAttribute('transform', `translate(${f(-lx * 2)} ${f(-ly * 1.5)})`);
    e.earsFront.setAttribute('transform', `translate(${f(lx * 2)} ${f(ly * 1.2)})`);
    e.face.setAttribute('transform', `translate(${f(lx * 5)} ${f(ly * 4)})`);
    e.muzzle.setAttribute('transform', `translate(${f(lx * 3.5)} ${f(ly * 2.5)})`);
    e.nose.setAttribute('transform', `translate(${f(lx * 5.5)} ${f(this.noseY + ly * 3.5)}) scale(${f(s.sx.x)} ${f(s.sy.x)})`);
    const ix = lx * this.er * 0.28, iy = ly * this.er * 0.22;
    for (const el of e.irises) el.setAttribute('transform', `translate(${f(ix)} ${f(iy)})`);
    const shut = now < this.squintUntil;
    for (const el of e.open) {
      el.setAttribute('visibility', shut ? 'hidden' : 'visible');
      el.setAttribute('transform', `scale(1 ${f(this.blink)})`);
    }
    for (const el of e.shut) el.setAttribute('visibility', shut ? 'visible' : 'hidden');
    e.brows.setAttribute('transform', `translate(0 ${f(shut ? -3 : 0)})`);
    for (const el of e.ears) {
      const right = el.classList.contains('ear-r');
      const a = (right ? s.earR.x : s.earL.x) * 0.06;
      el.setAttribute('transform', `rotate(${f(a)} ${el.dataset.px} ${el.dataset.py})`);
    }
    if (e.tag) e.tag.setAttribute('transform', `${this.tagBase} rotate(${f(s.tag.x * 0.08)})`);
    const tg = Math.max(0, s.tongue.x);
    e.tongue.setAttribute('transform', `translate(0 ${f(this.tongueY)}) scale(1 ${f(tg)})`);
    const lk = Math.max(0, Math.min(1.1, s.lick.x));
    e.lick.setAttribute('transform', `translate(${f(this.lickX)} ${f(this.lickY)}) rotate(-26) scale(1 ${f(lk)})`);
    const open = s.jaw.x > 0.3 || this.pant;
    if (open !== this.mouthShown) { e.mouthOpen.setAttribute('visibility', open ? 'visible' : 'hidden'); this.mouthShown = open; }
    if (e.chin) e.chin.setAttribute('cy', f(this.chinY + Math.max(0, s.jaw.x) * 5));
    e.puffs.setAttribute('opacity', f(Math.max(0, s.puff.x)));
  }
}
