// The boop and the sneeze, made on the spot with Web Audio: no sound files to download.

let ctx = null;
let on = true;

export const setSound = v => { on = !!v; };
export const soundOn = () => on;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A short rising blip. pitch > 1 for small dogs, < 1 for big ones.
export function boopSound(pitch = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const p = pitch * (0.94 + Math.random() * 0.12);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(380 * p, t);
  o.frequency.exponentialRampToValueAtTime(820 * p, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(600 * p, t + 0.16);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.22);
}

// A tiny "tchoo": a burst of filtered noise.
export function sneezeSound(pitch = 1) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const len = Math.floor(c.sampleRate * 0.22);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(3200 * pitch, t);
  bp.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.18);
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
}
