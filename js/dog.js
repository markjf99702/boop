// Draws a dog, head and shoulders, facing you, from a breed description in breeds.js.
// Everything is in one SVG with named groups, so dog-motion.js can move the parts.
// The head is centred on (0, 0): about ±w across and ±h tall. The SVG is 400 x 420 with the head at (200, 200).

import { smooth, both, furry, curly, shade, mix, seeded, r1 } from './geom.js';

const DEFAULTS = {
  head: { w: 90, h: 84, top: 0.62, cheek: 0.95, jaw: 0.56 },
  eyes: { gap: 34, y: -10, r: 9.5, color: '#4a2a17', lid: 0 },
  muzzle: { len: 46, w: 34, bridge: 14, lobe: 15, color: 'coat' },
  nose: { w: 36, h: 25, color: '#221c1a' },
  ears: { type: 'drop', len: 30, w: 1, spread: 0, color: 'coat' },
  body: { w: 150, chest: null },
};

export const VIEW = { w: 400, h: 420, x: 200, y: 200 };
const PINK = '#e7858c';
const INK = '#1b1513';

const merge = (base, over = {}) => {
  const out = { ...base, ...over };
  for (const k of Object.keys(base)) if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = { ...base[k], ...(over[k] || {}) };
  return out;
};

export function geometry(spec) {
  const s = merge(DEFAULTS, spec);
  const { w, h } = s.head;
  const er = s.eyes.r * 1.08, eg = s.eyes.gap, eyeY = s.eyes.y;
  const nw = s.nose.w * 1.18, nh = s.nose.h * 1.18;
  const noseY = eyeY + s.muzzle.len;
  const lobe = s.muzzle.lobe;
  const lobesY = noseY + nh * 0.5 + lobe * 0.42;
  const chinY = lobesY + lobe * 0.72;
  return { s, w, h, er, eg, eyeY, nw, nh, noseY, lobe, lobesY, chinY };
}

// The whole dog as SVG markup. uid keeps clip-path ids apart when several dogs are on one page.
export function drawDog(spec, { uid = 'dog', seed = 7, title } = {}) {
  const g = geometry(spec);
  const { s, w, h, er, eg, eyeY, nw, nh, noseY, lobe, lobesY, chinY } = g;
  const rand = seeded(seed);
  const col = k => (!k ? s.coat : k.startsWith('#') ? k : (s[k] || s.coat));
  const coat = s.coat;
  const headFill = col(s.head.fill || 'coat');

  // ---- head outline
  const H = s.head;
  const headPts = both([0, -h], [
    [w * H.top, -h * 0.93], [w * 0.94, -h * 0.52], [w, h * 0.02], [w * H.cheek * 0.95, h * 0.5], [w * H.jaw, h * 0.87],
  ], [0, h]);
  const headPath = smooth(headPts);
  let headShape = headPath;
  if (s.fur?.head) headShape = furry(headPts, { rand, ...s.fur.head });
  if (s.curls?.head) headShape = curly(headPts, s.curls.head);

  // ---- body
  const B = s.body;
  const bw = B.w;
  const bodyPts = both([0, h * 0.2], [[w * 0.64, h * 0.3], [w * 0.78, h * 1.05], [bw * 0.9, h * 1.75], [bw * 1.08, 250]], [0, 250]);
  const bodyFill = col(B.color || 'coat');
  let bodyShape = smooth(bodyPts);
  if (s.fur?.body) bodyShape = furry(bodyPts, { rand, ...s.fur.body });
  if (s.curls?.body) bodyShape = curly(bodyPts, s.curls.body);
  let body = `<path d="${bodyShape}" fill="${bodyFill}"/>`;
  // A little shade under the chin, and on the shoulders, so the head sits in front.
  body += `<g clip-path="url(#${uid}-body)">`;
  body += `<ellipse cx="0" cy="${r1(h * 0.98)}" rx="${r1(w * 0.8)}" ry="22" fill="${shade(bodyFill, -0.35)}" opacity=".28"/>`;
  if (B.chest) {
    const cw = B.chestW || 0.5;
    const chestPts = both([0, h * 0.7], [[w * 0.3 * cw * 2, h * 0.92], [w * cw, h * 1.6], [w * cw * 1.05, 250]], [0, 250]);
    const chestShape = s.fur?.chest ? furry(chestPts, { rand, ...s.fur.chest }) : smooth(chestPts);
    body += `<path d="${chestShape}" fill="${col(B.chest)}"/>`;
  }
  for (const spot of (B.spots || [])) body += `<ellipse cx="${spot[0]}" cy="${spot[1]}" rx="${spot[2]}" ry="${spot[3] || spot[2]}" fill="${col(spot[4] || 'dark')}"/>`;
  if (s.spots) body += spots(rand, s.spots, { x0: -bw, x1: bw, y0: h * 1.15, y1: 250, count: s.spots.body ?? 10, avoid: [] }, col('dark'));
  body += '</g>';

  // ---- collar and tag
  const cy0 = h * 0.97 + (s.collarY || 0);
  const nwid = w * 0.8 + (B.neck || 0);
  const sag = 9, band = 11;
  const collarCol = s.collar || '#c9463d';
  let collar = '';
  if (s.collar !== false) {
    collar += `<path d="M${r1(-nwid)} ${r1(cy0)}Q0 ${r1(cy0 + sag * 2)} ${r1(nwid)} ${r1(cy0)}L${r1(nwid)} ${r1(cy0 + band)}Q0 ${r1(cy0 + sag * 2 + band)} ${r1(-nwid)} ${r1(cy0 + band)}Z" fill="${collarCol}"/>`;
    collar += `<path d="M${r1(-nwid)} ${r1(cy0 + band - 2)}Q0 ${r1(cy0 + sag * 2 + band - 2)} ${r1(nwid)} ${r1(cy0 + band - 2)}" stroke="${shade(collarCol, -0.3)}" stroke-width="2.5" fill="none" opacity=".6"/>`;
    const ty = cy0 + sag + band + 1;
    const tag = s.tag || '#e2b84a';
    collar += `<g class="tag" transform="translate(0 ${r1(ty)})"><circle cy="-1" r="3.6" fill="none" stroke="${shade(tag, -0.35)}" stroke-width="2"/>`;
    collar += `<circle cy="11" r="9.5" fill="${tag}"/><circle cy="11" r="9.5" fill="none" stroke="${shade(tag, -0.25)}" stroke-width="1.5"/>`;
    collar += `<path d="M-4 7.5q4 -3 8 0" stroke="${shade(tag, 0.5)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/></g>`;
  }

  // ---- ears
  const earSpec = side => ({ ...DEFAULTS.ears, ...(s.ears[side] ? s.ears : {}), ...(s.ears[side] || s.ears) });
  const R = earSpec('r'), L = earSpec('l');
  const earR = ear(R, g, col, rand, uid + 'r');
  const earL = ear(L, g, col, rand, uid + 'l');
  const wrap = (e, cls, mirror) => `<g${mirror ? ' transform="scale(-1 1)"' : ''}><g class="ear ${cls}" data-px="${r1(e.pivot[0])}" data-py="${r1(e.pivot[1])}">${e.markup}</g></g>`;
  const earsBack = (R.front ? '' : wrap(earR, 'ear-r')) + (L.front ? '' : wrap(earL, 'ear-l', true));
  const earsFront = (R.front ? wrap(earR, 'ear-r') : '') + (L.front ? wrap(earL, 'ear-l', true) : '');

  // ---- markings on the head, clipped to it
  let marks = '';
  for (const m of s.marks || []) marks += mark(m, g, col, rand);
  if (s.spots) marks += spots(rand, s.spots, { x0: -w, x1: w, y0: -h, y1: h, count: s.spots.head ?? 12, avoid: [[-eg, eyeY, er * 2.2], [eg, eyeY, er * 2.2], [0, noseY, 40]] }, col('dark'));

  // Forehead wrinkles, for pugs and bloodhounds.
  let wrinkles = '';
  if (s.wrinkles) {
    const wc = shade(s.wrinkles.color ? col(s.wrinkles.color) : headFill, -0.28);
    const n = s.wrinkles.n || 3;
    for (let i = 0; i < n; i++) {
      const y = eyeY - er * 2.1 - i * 7 * (s.wrinkles.gap || 1);
      const span = eg * (0.7 - i * 0.08);
      wrinkles += `<path d="M${r1(-span)} ${r1(y + 3)}Q0 ${r1(y - 5)} ${r1(span)} ${r1(y + 3)}" stroke="${wc}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>`;
    }
    if (s.wrinkles.roll) {
      const y = noseY - nh * 0.5 - 7;
      wrinkles += `<path d="M${r1(-nw * 0.95)} ${r1(y + 8)}Q0 ${r1(y - 9)} ${r1(nw * 0.95)} ${r1(y + 8)}" stroke="${wc}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
    }
    if (s.wrinkles.cheeks) {
      for (const sx of [-1, 1]) wrinkles += `<path d="M${r1(sx * (eg + er * 1.6))} ${r1(eyeY + er * 1.5)}Q${r1(sx * (eg + er * 2.4))} ${r1(eyeY + er * 4)} ${r1(sx * (eg + er * 1.3))} ${r1(noseY + 8)}" stroke="${wc}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>`;
    }
  }

  // ---- eyes
  const eyeCol = s.eyes.color;
  const lidCol = col(s.eyes.lidColor || s.head.fill || 'coat');
  const rim = s.eyes.rim || INK;
  const oneEye = side => {
    const x = side * eg;
    const lid = s.eyes.lid;
    let e = `<g class="eye" transform="translate(${r1(x)} ${r1(eyeY)})"><g class="eye-open">`;
    if (s.eyes.haw) e += `<path d="M${r1(-er * 0.9)} ${r1(er * 0.5)}Q0 ${r1(er * 2.1)} ${r1(er * 0.9)} ${r1(er * 0.5)}Z" fill="#b8575a" opacity=".85"/>`;
    e += `<circle r="${r1(er + 1.8)}" fill="${rim}"/>`;
    e += `<g class="iris"><circle r="${r1(er)}" fill="${eyeCol}"/><circle r="${r1(er * 0.58)}" fill="#0c0806"/>`;
    e += `<circle cx="${r1(-er * 0.3)}" cy="${r1(-er * 0.34)}" r="${r1(er * 0.33)}" fill="#fff"/><circle cx="${r1(er * 0.36)}" cy="${r1(er * 0.32)}" r="${r1(er * 0.13)}" fill="#fff" opacity=".8"/></g>`;
    if (lid > 0) {
      const R0 = er + 2.6, y0 = -R0 + 2 * R0 * lid;
      const hx = Math.sqrt(Math.max(0, R0 * R0 - y0 * y0));
      // Droopy lids slope down toward the outside of the face.
      e += `<path d="M${r1(-hx - 1)} ${r1(y0 - side * 1.5)}A${r1(R0)} ${r1(R0)} 0 0 1 ${r1(hx + 1)} ${r1(y0 + side * 1.5)}Z" fill="${lidCol}"/>`;
      e += `<path d="M${r1(-hx)} ${r1(y0 - side * 1.5)}L${r1(hx)} ${r1(y0 + side * 1.5)}" stroke="${rim}" stroke-width="2" stroke-linecap="round"/>`;
    }
    e += `</g><path class="eye-shut" d="M${r1(-er * 1.05)} ${r1(er * 0.25)}Q0 ${r1(-er * 1.05)} ${r1(er * 1.05)} ${r1(er * 0.25)}" stroke="${rim}" stroke-width="${r1(Math.max(3, er * 0.4))}" fill="none" stroke-linecap="round" visibility="hidden"/></g>`;
    return e;
  };
  const eyes = oneEye(-1) + oneEye(1);

  let brows = '';
  if (s.brows) {
    const bc = col(s.brows.color || 'tan');
    for (const sx of [-1, 1]) brows += `<ellipse cx="${r1(sx * (eg + (s.brows.dx || 2)))}" cy="${r1(eyeY - er - (s.brows.dy || 8))}" rx="${r1(er * (s.brows.rx || 0.8))}" ry="${r1(er * (s.brows.ry || 0.5))}" transform="rotate(${sx * (s.brows.rot ?? 12)} ${r1(sx * eg)} ${r1(eyeY - er - 8)})" fill="${bc}"/>`;
  }

  // ---- muzzle
  const M = s.muzzle;
  const mcol = col(M.color);
  const mfill = M.color === 'coat' || !M.color ? shade(coat, s.muzzle.tone ?? 0.07) : mcol;
  const mw = Math.max(M.w, lobe * 1.85 + 2);
  const bridgeTop = eyeY + er * 0.2;
  const bridgeLow = Math.max(eyeY + er * 1.2, noseY - nh * 1.15);
  const muzzleRight = [[M.bridge, eyeY + er * 0.6]];
  if (bridgeLow > eyeY + er * 1.4) muzzleRight.push([M.bridge * 1.08, bridgeLow]);
  muzzleRight.push([mw, noseY + nh * 0.12], [mw * 0.98, lobesY + lobe * 0.38], [mw * 0.6, chinY + lobe * 0.42]);
  const muzzlePts = both([0, bridgeTop], muzzleRight, [0, chinY + lobe * 0.58]);
  let muzzle = `<path d="${M.fur ? furry(muzzlePts, { rand, ...M.fur }) : smooth(muzzlePts)}" fill="${mfill}"/>`;
  if (M.bridgeColor) {
    const bc = col(M.bridgeColor);
    muzzle += `<path d="${smooth(both([0, bridgeTop - 2], [[M.bridge * 1.05, eyeY + er * 0.6], [M.bridge * 1.1, noseY - nh * 0.3]], [0, noseY]))}" fill="${bc}"/>`;
  }
  const lobeCol = M.lobeColor ? col(M.lobeColor) : mfill;
  const chinCol = shade(M.chinColor ? col(M.chinColor) : lobeCol, -0.1);
  const mouthCol = shade(lobeCol, -0.55);
  // Open mouth (hidden unless panting), chin, tongue, lips.
  const oy = lobesY + lobe * 0.35;
  muzzle += `<g class="mouth-open" visibility="${s.pant ? 'visible' : 'hidden'}"><path d="M${r1(-lobe * 1.45)} ${r1(oy - 2)}Q0 ${r1(oy + lobe * 2.3)} ${r1(lobe * 1.45)} ${r1(oy - 2)}Z" fill="#4b1c22"/></g>`;
  muzzle += `<ellipse class="chin" cx="0" cy="${r1(chinY)}" rx="${r1(lobe * 1.05)}" ry="${r1(lobe * 0.55)}" fill="${chinCol}"/>`;
  const tw = lobe * 1.15, ty0 = lobesY + lobe * 0.2, tl = lobe * 2.1;
  muzzle += `<g class="tongue" data-y="${r1(ty0)}" transform="translate(0 ${r1(ty0)}) scale(1 ${s.pant ? 1 : 0})"><path d="M${r1(-tw / 2)} 0L${r1(-tw / 2)} ${r1(tl - tw / 2)}A${r1(tw / 2)} ${r1(tw / 2)} 0 0 0 ${r1(tw / 2)} ${r1(tl - tw / 2)}L${r1(tw / 2)} 0Z" fill="${PINK}"/><path d="M0 2L0 ${r1(tl * 0.6)}" stroke="${shade(PINK, -0.25)}" stroke-width="2" stroke-linecap="round"/></g>`;
  for (const sx of [-1, 1]) muzzle += `<circle cx="${r1(sx * lobe * 0.9)}" cy="${r1(lobesY)}" r="${r1(lobe)}" fill="${lobeCol}"/>`;
  // Whisker spots.
  for (const sx of [-1, 1]) for (const [dx, dy] of [[0.55, -0.15], [0.95, -0.3], [0.8, 0.2], [1.25, 0]]) {
    muzzle += `<circle cx="${r1(sx * lobe * dx + sx * 1)}" cy="${r1(lobesY + lobe * dy)}" r="1.3" fill="${shade(lobeCol, -0.35)}" opacity=".7"/>`;
  }
  const py = lobesY + lobe * 0.32;
  muzzle += `<path class="mouth" d="M${r1(-lobe * 1.75)} ${r1(lobesY + lobe * 0.05)}Q${r1(-lobe * 0.85)} ${r1(lobesY + lobe * 1.2)} 0 ${r1(py)}Q${r1(lobe * 0.85)} ${r1(lobesY + lobe * 1.2)} ${r1(lobe * 1.75)} ${r1(lobesY + lobe * 0.05)}" stroke="${mouthCol}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  muzzle += `<path d="M0 ${r1(noseY + nh * 0.4)}L0 ${r1(py)}" stroke="${mouthCol}" stroke-width="2.4" stroke-linecap="round"/>`;
  // A beard (schnauzers) hangs over the lips and chin.
  if (M.beard) {
    const bd = M.beard;
    const bc = col(bd.color || 'light');
    const beardPts = both([0, noseY + nh * 0.2], [[mw * 0.9, noseY + nh * 0.4], [mw * 1.08, lobesY + lobe * 0.3], [mw * 0.95, chinY + bd.len * 0.6], [mw * 0.5, chinY + bd.len]], [0, chinY + bd.len + 4]);
    muzzle += `<path d="${furry(beardPts, { rand, count: 26, amp: 5, from: 0.12, to: 0.88, droop: 0.9 })}" fill="${bc}"/>`;
    muzzle += `<path d="M0 ${r1(noseY + nh * 0.45)}L0 ${r1(lobesY + lobe * 0.5)}" stroke="${shade(bc, -0.3)}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`;
  }

  // ---- nose
  const ncol = s.nose.color;
  let nose = `<path d="M${r1(-nw / 2)} ${r1(-nh * 0.18)}C${r1(-nw / 2)} ${r1(-nh * 0.56)} ${r1(-nw * 0.2)} ${r1(-nh / 2)} 0 ${r1(-nh / 2)}C${r1(nw * 0.2)} ${r1(-nh / 2)} ${r1(nw / 2)} ${r1(-nh * 0.56)} ${r1(nw / 2)} ${r1(-nh * 0.18)}C${r1(nw / 2)} ${r1(nh * 0.22)} ${r1(nw * 0.2)} ${r1(nh / 2)} 0 ${r1(nh / 2)}C${r1(-nw * 0.2)} ${r1(nh / 2)} ${r1(-nw / 2)} ${r1(nh * 0.22)} ${r1(-nw / 2)} ${r1(-nh * 0.18)}Z" fill="${ncol}"/>`;
  const dark = shade(ncol, -0.6);
  for (const sx of [-1, 1]) {
    nose += `<ellipse cx="${r1(sx * nw * 0.22)}" cy="${r1(nh * 0.06)}" rx="${r1(nw * 0.12)}" ry="${r1(nh * 0.15)}" transform="rotate(${sx * -28} ${r1(sx * nw * 0.22)} ${r1(nh * 0.06)})" fill="${dark}"/>`;
    nose += `<path d="M${r1(sx * nw * 0.3)} ${r1(nh * 0.14)}q${r1(sx * nw * 0.1)} ${r1(nh * 0.08)} ${r1(sx * nw * 0.14)} ${r1(nh * 0.01)}" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  nose += `<path d="M0 ${r1(nh * 0.14)}L0 ${r1(nh * 0.46)}" stroke="${dark}" stroke-width="1.6" stroke-linecap="round"/>`;
  nose += `<ellipse cx="${r1(-nw * 0.13)}" cy="${r1(-nh * 0.27)}" rx="${r1(nw * 0.17)}" ry="${r1(nh * 0.1)}" fill="#fff" opacity=".42"/>`;
  nose += `<circle cx="${r1(nw * 0.12)}" cy="${r1(-nh * 0.32)}" r="${r1(Math.max(1.2, nw * 0.04))}" fill="#fff" opacity=".5"/>`;
  // The tongue that comes up for a nose lick, in front of everything.
  const lw = lobe * 1.3;
  const lickLen = nh * 0.8 + lobe * 1.25;
  nose += `<g class="lick" data-y="${r1(lobesY - noseY)}" transform="translate(${r1(lobe * 0.25)} ${r1(lobesY - noseY)}) rotate(-12) scale(1 0)"><path d="M${r1(-lw / 2)} 0L${r1(-lw / 2)} ${r1(-lickLen + lw / 2)}A${r1(lw / 2)} ${r1(lw / 2)} 0 0 1 ${r1(lw / 2)} ${r1(-lickLen + lw / 2)}L${r1(lw / 2)} 0Z" fill="${PINK}"/><path d="M0 -2L0 ${r1(-lickLen * 0.6)}" stroke="${shade(PINK, -0.25)}" stroke-width="2" stroke-linecap="round"/></g>`;
  // Sneeze puffs, hidden until a sneeze.
  nose += `<g class="puffs" opacity="0">${[-1, 1].map(sx => `<path d="M${r1(sx * nw * 0.55)} ${r1(nh * 0.1)}q${r1(sx * 8)} 2 ${r1(sx * 14)} -2M${r1(sx * nw * 0.6)} ${r1(nh * 0.4)}q${r1(sx * 8)} 5 ${r1(sx * 13)} 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}</g>`;
  // A generous hit area, so the nose is easy to boop on a phone.
  const hitR = Math.max(34, nw * 0.85);
  nose += `<circle class="hit" r="${r1(hitR)}" cy="${r1(nh * 0.1)}" fill="transparent"/>`;

  // ---- hair on top (poodle topknot, schnauzer brows)
  let top = '';
  if (s.topknot) {
    const t = s.topknot;
    const tp = both([0, -h - t.h], [[w * t.w * 0.7, -h - t.h * 0.85], [w * t.w, -h * 0.7], [w * t.w * 0.85, -h * 0.35]], [0, -h * 0.45]);
    top += `<path d="${curly(tp, { count: t.curls || 22, amp: 1 })}" fill="${col(t.color || 'coat')}"/>`;
    top += `<path d="${curly(tp, { count: t.curls || 22, amp: 1 })}" fill="none" stroke="${shade(col(t.color || 'coat'), -0.12)}" stroke-width="1.5" opacity=".6"/>`;
  }
  if (s.bushyBrows) {
    const bc = col(s.bushyBrows.color || 'light');
    for (const sx of [-1, 1]) {
      const bp = [[sx * (eg * 0.2), eyeY - er * 1.4], [sx * (eg + er * 0.6), eyeY - er * 2.2], [sx * (eg + er * 2.1), eyeY - er * 0.6], [sx * (eg + er * 0.4), eyeY - er * 1.2]];
      brows += `<path d="${furry(bp, { rand, count: 12, amp: 4, from: 0.3, to: 0.85, droop: 1.1 })}" fill="${bc}"/>`;
    }
  }

  const tip = title ? `<title>${title}</title>` : '';
  return `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title || ''}">${tip}
<defs><clipPath id="${uid}-head"><path d="${headPath}"/></clipPath><clipPath id="${uid}-body"><path d="${smooth(bodyPts)}"/></clipPath></defs>
<g class="dog" transform="translate(${VIEW.x} ${VIEW.y})">
<g class="body">${body}${collar}</g>
<g class="head">
<g class="ears-back">${earsBack}</g>
<g class="skull"><path d="${headShape}" fill="${headFill}"${s.head.rim ? ` stroke="${col(s.head.rim)}" stroke-width="3"` : ''}/>${s.fur?.head ? `<path d="${headPath}" fill="${headFill}"/>` : ''}<g clip-path="url(#${uid}-head)">${marks}</g>${wrinkles}${top}</g>
<g class="ears-front">${earsFront}</g>
<g class="face">
<g class="eyes">${eyes}</g>
<g class="brows">${brows}</g>
<g class="muzzle">${muzzle}</g>
<g class="nose" transform="translate(0 ${r1(noseY)})" data-y="${r1(noseY)}" tabindex="0" role="button" aria-label="Boop the nose">${nose}</g>
</g>
</g>
</g>
</svg>`;
}

// ---- ears. Each returns markup for the right ear; the left is drawn mirrored.
function ear(E, g, col, rand, id) {
  const { w, h } = g;
  const c = col(E.color || 'coat');
  const inner = E.inner ? col(E.inner) : mix(c, '#e8a3a0', 0.55);
  const len = E.len, sp = E.spread || 0, ew = E.w || 1;
  let pts, innerPts, pivot, front = false, extra = '';
  switch (E.type) {
    case 'prick': case 'bat': case 'semi': {
      const bat = E.type === 'bat';
      const A = [w * (0.14 + (E.inset || 0)), -h * 0.86];
      const B = [w * (0.9 + (ew - 1) * 0.3), -h * 0.42];
      const L = E.type === 'semi' ? len * 0.72 : len;
      const T = [w * (0.62 + sp), -h - L];
      if (bat) {
        pts = [[A[0], A[1] + 10], [w * 0.14, -h - L * 0.45], [w * (0.3 + sp), -h - L * 0.92], T, [w * (0.9 + sp), -h - L * 0.72], [w * (1.02 + sp * 0.5), -h * 0.9], B, [w * 0.6, -h * 0.4]];
      } else {
        const tipR = E.tip ?? 1;
        pts = [[A[0], A[1] + 10], [A[0] + (T[0] - A[0]) * 0.45 - 6 * ew, A[1] + (T[1] - A[1]) * 0.5],
          [T[0] - 5 * tipR, T[1] + 7 * tipR], T, [T[0] + 7 * tipR, T[1] + 6 * tipR],
          [B[0] + (T[0] - B[0]) * 0.45 + 12 * ew, B[1] + (T[1] - B[1]) * 0.5], B, [w * 0.6, -h * 0.4]];
      }
      innerPts = pts.slice(1, 6).map(([x, y]) => [x + (w * 0.55 - x) * 0.3, y + (-h * 0.75 - y) * 0.26]);
      innerPts.push([w * 0.55, -h * 0.78]);
      pivot = [w * 0.55, -h * 0.72];
      if (E.type === 'semi') {
        // The tip folds forward and hangs over.
        const f1 = pts[2], f2 = pts[4];
        const hang = [T[0] + len * 0.12, T[1] + len * 0.38];
        extra = `<path d="${smooth([[f1[0] - 3, f1[1] + 2], [(f1[0] + f2[0]) / 2, (f1[1] + f2[1]) / 2 - 6], [f2[0] + 3, f2[1] + 2], hang])}" fill="${shade(c, -0.1)}"/>`;
      }
      break;
    }
    case 'drop': case 'feather': {
      front = true;
      const A = [w * 0.4, -h * 0.9], B = [w * 0.9, -h * 0.72];
      pts = [A, B, [w * (1.1 + sp), -h * 0.32], [w * (1.1 + sp) * ew, h * 0.02 + len * 0.6], [w * (0.98 + sp), h * 0.02 + len], [w * 0.8, h * 0.02 + len * 0.82], [w * 0.66, -h * 0.35]];
      pivot = [w * 0.66, -h * 0.82];
      break;
    }
    case 'hound': case 'poodle': {
      front = true;
      const A = [w * 0.5, -h * 0.76], B = [w * 0.95, -h * 0.66];
      pts = [A, B, [w * (1.16 + sp), -h * 0.2], [w * (1.22 + sp) * ew, h * 0.45 + len * 0.55], [w * (1.1 + sp), h * 0.55 + len], [w * (0.9 + sp * 0.5), h * 0.58 + len * 0.94], [w * 0.8, h * 0.45 + len * 0.45], [w * 0.74, -h * 0.1]];
      pivot = [w * 0.74, -h * 0.72];
      break;
    }
    case 'fold': {
      front = true;
      const A = [w * (0.36 + (E.inset || 0)), -h * 0.93], B = [w * (0.92 + sp * 0.5), -h * 0.8];
      pts = [A, [w * (0.62 + sp * 0.5), -h * 1.02 - len * 0.08], B, [w * (1.0 + sp), -h * 0.8 + len * 0.7], [w * (0.86 + sp), -h * 0.8 + len * 1.45], [w * (0.6 + sp * 0.5), -h * 0.82 + len * 0.7]];
      pivot = [w * 0.62, -h * 0.92];
      extra = `<path d="M${r1(A[0] + 4)} ${r1(A[1] - 1)}Q${r1(w * (0.62 + sp * 0.5))} ${r1(-h * 1.02 - len * 0.08)} ${r1(B[0] - 3)} ${r1(B[1] - 2)}" stroke="${shade(c, 0.25)}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".5"/>`;
      break;
    }
    case 'rose': {
      pts = [[w * 0.45, -h * 0.9], [w * 0.84, -h * 1.04 - len * 0.1], [w * (1.18 + sp), -h * 0.98 - len * 0.2], [w * (1.3 + sp), -h * 0.86], [w * (1.1 + sp), -h * 0.8], [w * 0.84, -h * 0.7]];
      innerPts = [[w * 0.76, -h * 0.9], [w * 0.98, -h * 0.99 - len * 0.05], [w * 1.04, -h * 0.9], [w * 0.86, -h * 0.82]];
      pivot = [w * 0.75, -h * 0.8];
      break;
    }
  }
  let shape = smooth(pts);
  if (E.type === 'feather' || E.fluffy) shape = furry(pts, { rand, count: E.tufts || 22, amp: E.amp || 5, from: E.from ?? 0.25, to: E.to ?? 0.95, droop: 0.8 });
  if (E.type === 'poodle') shape = curly(pts, { count: 24 });
  let markup = `<path d="${shape}" fill="${c}"/>`;
  if (innerPts && !E.noInner) markup += `<path d="${smooth(innerPts)}" fill="${inner}"/>`;
  if (E.fluffyInner) markup += `<path d="${furry(innerPts, { rand, count: 10, amp: 3, from: 0.6, to: 0.1, droop: 0.2 })}" fill="${col(E.fluffyInner)}"/>`;
  if (E.type === 'poodle') markup += `<path d="${shape}" fill="none" stroke="${shade(c, -0.12)}" stroke-width="1.5" opacity=".6"/>`;
  if (E.tipColor) markup += `<g clip-path="url(#${id}-clip)"><rect x="${r1(w * 0.2)}" y="${r1(-h - len - 20)}" width="${r1(w * 1.5)}" height="${r1(len * (E.tipFrac || 0.4) + 20)}" fill="${col(E.tipColor)}"/></g><clipPath id="${id}-clip"><path d="${shape}"/></clipPath>`;
  if (front) {
    // A soft shadow line where a hanging ear lies against the head.
    markup = `<path d="${shape}" fill="${shade(c, -0.35)}" opacity=".3" transform="translate(-3 3)"/>` + markup + `<path d="${shape}" fill="none" stroke="${shade(c, -0.14)}" stroke-width="1.4" opacity=".7"/>`;
    if (E.spots) markup += `<g clip-path="url(#${id}-clip)">${spots(rand, { size: E.spots.size || 6 }, { x0: w * 0.5, x1: w * 1.3, y0: -h, y1: h * 0.6 + len, count: E.spots.n || 5, avoid: [] }, col('dark'))}</g><clipPath id="${id}-clip"><path d="${shape}"/></clipPath>`;
  }
  return { markup: markup + extra, pivot, front };
}

// ---- markings on the face
function mark(m, g, col, rand) {
  const { w, h, er, eg, eyeY, noseY, nh, lobesY, lobe } = g;
  const type = typeof m === 'string' ? m : m.type;
  const o = typeof m === 'string' ? {} : m;
  const c = col(o.color || (type === 'blaze' || type === 'cheeks' ? 'light' : 'dark'));
  switch (type) {
    case 'blaze': {
      const t = o.top ?? 10, mid = o.mid ?? 6;
      return `<path d="${smooth(both([0, -h * 1.1], [[t, -h * 0.92], [mid, eyeY - er * 1.2], [mid * 1.3, eyeY + er * 0.8], [mid * 2.6, eyeY + er * 3]], [0, noseY]))}" fill="${c}"/>`;
    }
    case 'mask': {
      // Dark around both eyes and down over the muzzle.
      const gx = eg + er * (o.wide ?? 2.3);
      return `<path d="${smooth(both([0, eyeY - er * (o.up ?? 1.2)], [[eg * 0.6, eyeY - er * 2.3], [eg + er * 0.8, eyeY - er * 2.4], [gx, eyeY - er * 0.2], [eg + er * 1.3, eyeY + er * 2.6], [eg * 0.9, noseY], [lobe * 2.2, lobesY + lobe]], [0, h * 1.1]))}" fill="${c}"/>`;
    }
    case 'shepherd': {
      // A German Shepherd's black muzzle, running up between the eyes, with dark round the eyes and a darker crown.
      let d = `<path d="${smooth(both([0, -h * 1.2], [[w * 0.9, -h * 1.1], [w * 0.75, -h * 0.72], [w * 0.3, -h * 0.62]], [0, -h * 0.5]))}" fill="${c}" opacity=".35"/>`;
      d += `<path d="${smooth(both([0, -h * 0.75], [[w * 0.07, -h * 0.6], [eg * 0.3, eyeY - er * 1.4], [eg * 0.55, eyeY + er * 0.9], [eg * 0.95, noseY - 4], [lobe * 2.2, lobesY + lobe]], [0, h * 1.1]))}" fill="${c}"/>`;
      for (const sx of [-1, 1]) d += `<ellipse cx="${r1(sx * (eg - 1))}" cy="${r1(eyeY + 1)}" rx="${r1(er * 1.55)}" ry="${r1(er * 1.2)}" transform="rotate(${sx * 22} ${r1(sx * eg)} ${r1(eyeY)})" fill="${c}"/>`;
      return d;
    }
    case 'cap': {
      // A husky's dark cap, with a point down the forehead between the eyes.
      const pts = [[-w * 1.3, -h * 1.4], [w * 1.3, -h * 1.4], [w * 1.2, eyeY - er * 0.2], [eg + er * 2.2, eyeY - er * 0.6], [eg + er * 0.4, eyeY - er * 1.9], [eg * 0.45, eyeY - er * 1.6], [0, eyeY + er * (o.peak ?? 0.9)], [-eg * 0.45, eyeY - er * 1.6], [-(eg + er * 0.4), eyeY - er * 1.9], [-(eg + er * 2.2), eyeY - er * 0.6], [-w * 1.2, eyeY - er * 0.2]];
      let d = `<path d="${smooth(pts)}" fill="${c}"/>`;
      if (o.spots !== false) for (const sx of [-1, 1]) d += `<ellipse cx="${r1(sx * (eg + 1))}" cy="${r1(eyeY - er * 2.1)}" rx="${r1(er * 0.85)}" ry="${r1(er * 0.55)}" fill="${col('light')}"/>`;
      return d;
    }
    case 'cheeks': {
      const pts = both([0, eyeY + er * (o.top ?? 1.6)], [[eg * 0.55, eyeY + er * 1.4], [eg + er * 1.5, eyeY + er * 1.3], [w * 1.08, h * 0.2], [w * 0.9, h * 1.05]], [0, h * 1.2]);
      return `<path d="${smooth(pts)}" fill="${c}"/>`;
    }
    case 'patch': {
      const sx = o.side || 1;
      return `<ellipse cx="${r1(sx * (eg + 3))}" cy="${r1(eyeY - 3)}" rx="${r1(er * (o.rx || 2.6))}" ry="${r1(er * (o.ry || 2.3))}" transform="rotate(${sx * -20} ${r1(sx * eg)} ${r1(eyeY)})" fill="${c}"/>`;
    }
    case 'half': {
      // One side of the head a different colour (mixed-breed patches).
      const sx = o.side || 1;
      return `<path d="${smooth([[sx * 4, -h * 1.2], [sx * w * 1.2, -h * 1.2], [sx * w * 1.2, eyeY + er * 2], [sx * (eg + er * 1.5), eyeY + er * 1.8], [sx * eg * 0.3, eyeY]])}" fill="${c}"/>`;
    }
    case 'forehead': {
      return `<ellipse cx="0" cy="${r1(-h * 0.72)}" rx="${r1(w * (o.rx || 0.5))}" ry="${r1(h * (o.ry || 0.35))}" fill="${c}"/>`;
    }
  }
  return '';
}

function spots(rand, opt, { x0, x1, y0, y1, count, avoid }, c) {
  let out = '';
  let tries = 0, n = 0;
  const size = opt.size || 7;
  while (n < count && tries++ < count * 20) {
    const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0);
    if (avoid.some(([ax, ay, ar]) => Math.hypot(x - ax, y - ay) < ar)) continue;
    const r = size * (0.55 + rand() * 0.7);
    out += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(r)}" ry="${r1(r * (0.75 + rand() * 0.3))}" transform="rotate(${Math.round(rand() * 180)} ${r1(x)} ${r1(y)})" fill="${c}"/>`;
    n++;
  }
  return out;
}
