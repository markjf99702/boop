// A mixed-breed dog comes out different every time: coat, ears and markings are shuffled from these.

const COATS = [
  { coat: '#8c5a3a', light: '#f3e9da', dark: '#3b2a20', ear: '#7a4b2f', bg: '#dfe8c4' },
  { coat: '#2b2624', light: '#f3efe8', dark: '#161312', ear: '#221e1c', bg: '#f1d9b5' },
  { coat: '#c9a06a', light: '#f6ecdc', dark: '#6b4a2e', ear: '#b58a55', bg: '#cadbe8' },
  { coat: '#6d6660', light: '#eeeae4', dark: '#34302c', ear: '#5c5550', bg: '#f0d2c4' },
  { coat: '#b5652f', light: '#f5eadb', dark: '#5a2f15', ear: '#9c5427', bg: '#d4e6dc' },
  { coat: '#e9dcc6', light: '#fbf7f0', dark: '#8b6a48', ear: '#c9a57a', bg: '#d6d2ea' },
];
const EARS = [
  [{ type: 'fold', len: 20 }, { type: 'prick', len: 48, spread: 0.15 }],
  [{ type: 'prick', len: 50, spread: 0.2 }, { type: 'prick', len: 50, spread: 0.2 }],
  [{ type: 'drop', len: 32 }, { type: 'drop', len: 32 }],
  [{ type: 'fold', len: 22, inset: 0.05 }, { type: 'fold', len: 22, inset: 0.05 }],
  [{ type: 'rose', len: 16 }, { type: 'rose', len: 16 }],
  [{ type: 'semi', len: 52, spread: 0.3 }, { type: 'semi', len: 52, spread: 0.3 }],
  [{ type: 'prick', len: 46, spread: 0.2 }, { type: 'drop', len: 30 }],
];
const MARKS = [
  [{ type: 'patch', side: -1 }],
  [{ type: 'patch', side: 1 }],
  [{ type: 'blaze', top: 8, mid: 6 }],
  [],
  [{ type: 'half', side: 1 }],
  [{ type: 'blaze', top: 5, mid: 5 }, { type: 'patch', side: 1, rx: 2.2, ry: 2 }],
];

const COLLARS = ['#7a4bb0', '#d2473b', '#2f8f5b', '#3a6fb8', '#e0a93a', '#e05c87', '#2d7f8f'];

export function mutt(base, rand = Math.random) {
  const pick = list => list[Math.floor(rand() * list.length)];
  const c = pick(COATS);
  const [r, l] = pick(EARS);
  const flip = rand() < 0.5;
  const inner = '#e1a79f';
  const earR = { ...(flip ? l : r), color: c.ear, inner };
  const earL = { ...(flip ? r : l), color: c.ear, inner };
  const lightMuzzle = rand() < 0.7;
  return {
    ...base,
    bg: c.bg, coat: c.coat, light: c.light, dark: c.dark,
    ears: { r: earR, l: earL },
    marks: pick(MARKS),
    muzzle: { ...base.muzzle, color: lightMuzzle ? 'light' : 'coat', len: 42 + Math.round(rand() * 14) },
    head: { ...base.head, w: 84 + Math.round(rand() * 10) },
    body: { ...base.body, chest: rand() < 0.75 ? 'light' : null },
    pant: rand() < 0.3,
    collar: pick(COLLARS),
  };
}
