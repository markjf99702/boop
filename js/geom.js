// Small drawing helpers: smooth outlines through points, mirrored halves, colour shades and a seeded random.

const f = n => Math.round(n * 10) / 10;

// A smooth closed (or open) path through the points, Catmull-Rom turned into cubic Béziers.
export function smooth(pts, closed = true, tension = 1) {
  const n = pts.length;
  const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

// The same curve as dense points, for outlines that get fur added to them.
export function sample(pts, per = 10, closed = true, tension = 1) {
  const n = pts.length;
  const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const out = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension];
    for (let k = 0; k < per; k++) {
      const t = k / per, u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// Points around a closed outline, evenly spaced by length.
export function even(dense, count) {
  const seg = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    seg.push(seg[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = seg[seg.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const want = total * k / count;
    while (seg[j] < want) j++;
    const a = dense[j - 1], b = dense[j % dense.length];
    const t = (want - seg[j - 1]) / (seg[j] - seg[j - 1] || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// A right half (top to bottom) and its mirror, as one closed outline running clockwise from the top.
export function both(top, right, bottom) {
  const left = right.slice().reverse().map(([x, y]) => [-x, y]);
  return [top, ...right, bottom, ...left];
}

// A fringe of fur along part of a closed outline. from/to are fractions of the way round, clockwise from the start.
// Tufts point outward and a little downward, the way fur falls.
export function furry(pts, { count = 40, amp = 6, from = 0, to = 1, droop = 0.35, rand = Math.random } = {}) {
  const dense = sample(pts, 14);
  const ev = even(dense, count);
  // Centre of the shape, to tell outward from inward.
  const cx = ev.reduce((s, p) => s + p[0], 0) / ev.length;
  const cy = ev.reduce((s, p) => s + p[1], 0) / ev.length;
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = ev[i], b = ev[(i + 1) % count];
    const t = i / count;
    const on = from <= to ? t >= from && t < to : t >= from || t < to;
    if (i === 0) d += `M${f(a[0])} ${f(a[1])}`;
    if (!on) { d += `L${f(b[0])} ${f(b[1])}`; continue; }
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    const k = amp * (0.7 + rand() * 0.6);
    const tx = mx + nx * k, ty = my + ny * k + k * droop;
    d += `Q${f(a[0] + nx * k * 0.5)} ${f(a[1] + ny * k * 0.5 + k * droop * 0.3)} ${f(tx)} ${f(ty)}`;
    d += `Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`;
  }
  return d + 'Z';
}

// Curls: the outline as a run of small bumps, for poodles.
export function curly(pts, { count = 30, amp = 1 } = {}) {
  const ev = even(sample(pts, 14), count);
  let d = `M${f(ev[0][0])} ${f(ev[0][1])}`;
  for (let i = 0; i < count; i++) {
    const a = ev[i], b = ev[(i + 1) % count];
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.56 * amp;
    d += `A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
  }
  return d + 'Z';
}

// Mix a colour toward white (amt > 0) or black (amt < 0).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const to = amt > 0 ? 255 : 0, k = Math.abs(amt);
  r = Math.round(r + (to - r) * k); g = Math.round(g + (to - g) * k); b = Math.round(b + (to - b) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// Blend two colours, t = 0 gives a, t = 1 gives b.
export function mix(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// mulberry32: the same numbers every time for the same seed.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export { f as r1 };
