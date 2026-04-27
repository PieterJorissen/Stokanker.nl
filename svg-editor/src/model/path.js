// PathCommands — lossless parse/serialize of SVG path `d` attribute.
// Each command is { letter, args[] } where letter is exact (case preserved).
// Implicit command repetition is expanded into explicit commands for editability.
// Serializes back to a compact, valid d string.

// Number of coordinate arguments per single command instance
const ARITY = {
  M: 2, m: 2,
  Z: 0, z: 0,
  L: 2, l: 2,
  H: 1, h: 1,
  V: 1, v: 1,
  C: 6, c: 6,
  S: 4, s: 4,
  Q: 4, q: 4,
  T: 2, t: 2,
  A: 7, a: 7,
};

// What letter implicit repetitions become after the first command
const IMPLICIT_REPEAT = { M: 'L', m: 'l' };

/** Parse an SVG `d` string into PathCommand[]. */
export function parseD(d) {
  if (!d || !d.trim()) return [];

  const tokens = tokenizeD(d);
  const commands = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (!isLetter(tok)) { i++; continue; } // skip stray numbers
    const letter = tok;
    i++;
    const arity = ARITY[letter];

    if (arity === 0) {
      commands.push({ letter, args: [] });
      continue;
    }

    // First instance of this command
    const firstArgs = readArgs(tokens, i, arity);
    if (firstArgs.length === arity) {
      i += arity;
      commands.push({ letter, args: firstArgs });
    } else {
      i += firstArgs.length;
      continue;
    }

    // Implicit repetitions: subsequent numeric groups with same arity
    const repeatLetter = IMPLICIT_REPEAT[letter] ?? letter;
    while (i < tokens.length && isNumber(tokens[i])) {
      const repArgs = readArgs(tokens, i, arity);
      if (repArgs.length !== arity) break;
      i += arity;
      commands.push({ letter: repeatLetter, args: repArgs });
    }
  }

  return commands;
}

/** Serialize PathCommand[] back to a `d` string. */
export function serializeD(commands) {
  if (!commands || commands.length === 0) return '';
  return commands.map(({ letter, args }) => {
    if (args.length === 0) return letter;
    return letter + args.map(formatNum).join(' ');
  }).join(' ');
}

/**
 * Compute absolute anchor positions for every command.
 * Returns an array parallel to `commands`, each entry:
 *   { absX, absY, controls: [{ x, y }] }
 * controls are control points (cp1, cp2) in absolute document coords.
 */
export function computePositions(commands) {
  let cx = 0, cy = 0;
  let initX = 0, initY = 0; // position of last M (for Z)
  let prevCpX = null, prevCpY = null; // for S/s and T/t reflection

  return commands.map(({ letter, args }) => {
    const L = letter.toUpperCase();
    const rel = letter !== L;
    let absX = cx, absY = cy, controls = [];

    const r = (base, delta) => rel ? base + delta : delta;

    if (L === 'M') {
      absX = r(cx, args[0]);
      absY = r(cy, args[1]);
      initX = absX; initY = absY;
      prevCpX = null; prevCpY = null;
    } else if (L === 'L' || L === 'T') {
      absX = r(cx, args[0]);
      absY = r(cy, args[1]);
      prevCpX = null; prevCpY = null;
    } else if (L === 'H') {
      absX = r(cx, args[0]);
      absY = cy;
      prevCpX = null; prevCpY = null;
    } else if (L === 'V') {
      absX = cx;
      absY = r(cy, args[0]);
      prevCpX = null; prevCpY = null;
    } else if (L === 'C') {
      const cp1x = r(cx, args[0]), cp1y = r(cy, args[1]);
      const cp2x = r(cx, args[2]), cp2y = r(cy, args[3]);
      absX = r(cx, args[4]); absY = r(cy, args[5]);
      controls = [{ x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }];
      prevCpX = cp2x; prevCpY = cp2y;
    } else if (L === 'S') {
      // cp1 is reflection of previous cp2
      const cp1x = prevCpX !== null ? 2 * cx - prevCpX : cx;
      const cp1y = prevCpY !== null ? 2 * cy - prevCpY : cy;
      const cp2x = r(cx, args[0]), cp2y = r(cy, args[1]);
      absX = r(cx, args[2]); absY = r(cy, args[3]);
      controls = [{ x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }];
      prevCpX = cp2x; prevCpY = cp2y;
    } else if (L === 'Q') {
      const cpx = r(cx, args[0]), cpy = r(cy, args[1]);
      absX = r(cx, args[2]); absY = r(cy, args[3]);
      controls = [{ x: cpx, y: cpy }];
      prevCpX = cpx; prevCpY = cpy;
    } else if (L === 'A') {
      absX = r(cx, args[5]); absY = r(cy, args[6]);
      prevCpX = null; prevCpY = null;
    } else if (L === 'Z') {
      absX = initX; absY = initY;
      prevCpX = null; prevCpY = null;
    }

    cx = absX; cy = absY;
    return { absX, absY, controls };
  });
}

/** Default args for a newly appended command, relative to current pen position. */
export function defaultArgs(letter, cx, cy) {
  const L = letter.toUpperCase();
  const rel = letter !== L;
  switch (L) {
    case 'M': return rel ? [0, 0] : [cx, cy];
    case 'L': return rel ? [20, 0] : [cx + 20, cy];
    case 'H': return rel ? [20] : [cx + 20];
    case 'V': return rel ? [20] : [cy + 20];
    case 'C': return rel ? [10, -20, 30, -20, 40, 0] : [cx + 10, cy - 20, cx + 30, cy - 20, cx + 40, cy];
    case 'S': return rel ? [20, -20, 40, 0] : [cx + 20, cy - 20, cx + 40, cy];
    case 'Q': return rel ? [20, -20, 40, 0] : [cx + 20, cy - 20, cx + 40, cy];
    case 'T': return rel ? [40, 0] : [cx + 40, cy];
    case 'A': return rel ? [20, 20, 0, 0, 1, 40, 0] : [20, 20, 0, 0, 1, cx + 40, cy];
    case 'Z': return [];
    default: return [];
  }
}

/** Labels for each arg of a command letter. Used in the UI. */
export function argLabels(letter) {
  const L = letter.toUpperCase();
  switch (L) {
    case 'M': case 'L': case 'T': return ['x', 'y'];
    case 'H': return ['x'];
    case 'V': return ['y'];
    case 'C': return ['x1', 'y1', 'x2', 'y2', 'x', 'y'];
    case 'S': return ['x2', 'y2', 'x', 'y'];
    case 'Q': return ['x1', 'y1', 'x', 'y'];
    case 'A': return ['rx', 'ry', 'rot', 'large', 'sweep', 'x', 'y'];
    case 'Z': return [];
    default: return [];
  }
}

// --- Internal helpers ---

function tokenizeD(d) {
  const re = /([MmZzLlHhVvCcSsQqTtAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(d)) !== null) tokens.push(m[1] ?? m[2]);
  return tokens;
}

function isLetter(s) {
  return /^[MmZzLlHhVvCcSsQqTtAa]$/.test(s);
}

function isNumber(s) {
  return /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
}

function readArgs(tokens, start, count) {
  const args = [];
  let i = start;
  while (args.length < count && i < tokens.length && isNumber(tokens[i])) {
    args.push(parseFloat(tokens[i++]));
  }
  return args;
}

function formatNum(n) {
  if (!isFinite(n)) return '0';
  // Strip unnecessary trailing zeros from decimals
  const s = n.toFixed(4);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
