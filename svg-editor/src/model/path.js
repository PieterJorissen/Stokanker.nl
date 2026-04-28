// PathCommands — lossless parse/serialize of SVG path `d` attribute.
// Each command is a named-prop object: { letter, x, y } / { letter, x1, y1, x2, y2, x, y } / etc.
// Property names match SVG 1.1 spec (SVGPathSeg interface names).
// Implicit command repetition is expanded into explicit commands for editability.

// Named keys per command letter — single source of truth for arity and labels
export const KEYS = {
  M: ['x','y'],   m: ['x','y'],
  L: ['x','y'],   l: ['x','y'],
  T: ['x','y'],   t: ['x','y'],
  H: ['x'],       h: ['x'],
  V: ['y'],       v: ['y'],
  C: ['x1','y1','x2','y2','x','y'],   c: ['x1','y1','x2','y2','x','y'],
  S: ['x2','y2','x','y'],             s: ['x2','y2','x','y'],
  Q: ['x1','y1','x','y'],             q: ['x1','y1','x','y'],
  A: ['rx','ry','x-axis-rotation','large-arc-flag','sweep-flag','x','y'],
  a: ['rx','ry','x-axis-rotation','large-arc-flag','sweep-flag','x','y'],
  Z: [],          z: [],
};

// What letter implicit repetitions become after the first command
const IMPLICIT_REPEAT = { M: 'L', m: 'l' };

/** Parse an SVG `d` string into PathCommand[]. Each command is { letter, ...namedProps }. */
export function parseD(d) {
  if (!d || !d.trim()) return [];

  const tokens = tokenizeD(d);
  const commands = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (!isLetter(tok)) { i++; continue; }
    const letter = tok;
    i++;
    const keys = KEYS[letter];

    if (keys === undefined) { continue; }

    if (keys.length === 0) {
      commands.push({ letter });
      continue;
    }

    // First instance
    const firstVals = readVals(tokens, i, keys.length);
    if (firstVals.length === keys.length) {
      i += keys.length;
      commands.push(makeCmd(letter, keys, firstVals));
    } else {
      i += firstVals.length;
      continue;
    }

    // Implicit repetitions
    const repeatLetter = IMPLICIT_REPEAT[letter] ?? letter;
    const repeatKeys = KEYS[repeatLetter];
    while (i < tokens.length && isNumber(tokens[i])) {
      const repVals = readVals(tokens, i, repeatKeys.length);
      if (repVals.length !== repeatKeys.length) break;
      i += repeatKeys.length;
      commands.push(makeCmd(repeatLetter, repeatKeys, repVals));
    }
  }

  return commands;
}

/** Serialize PathCommand[] back to a `d` string. */
export function serializeD(commands) {
  if (!commands || commands.length === 0) return '';
  return commands.map(cmd => {
    const keys = KEYS[cmd.letter];
    if (!keys || keys.length === 0) return cmd.letter;
    return cmd.letter + keys.map(k => formatNum(cmd[k])).join(' ');
  }).join(' ');
}

/**
 * Compute absolute anchor positions for every command.
 * Returns an array parallel to `commands`, each entry:
 *   { absX, absY, controls: [{ x, y }] }
 */
export function computePositions(commands) {
  let cx = 0, cy = 0;
  let initX = 0, initY = 0;
  let prevCpX = null, prevCpY = null;

  return commands.map(cmd => {
    const { letter } = cmd;
    const L = letter.toUpperCase();
    const rel = letter !== L;
    let absX = cx, absY = cy, controls = [];

    const r = (base, delta) => rel ? base + delta : delta;

    if (L === 'M') {
      absX = r(cx, cmd.x);
      absY = r(cy, cmd.y);
      initX = absX; initY = absY;
      prevCpX = null; prevCpY = null;
    } else if (L === 'L' || L === 'T') {
      absX = r(cx, cmd.x);
      absY = r(cy, cmd.y);
      prevCpX = null; prevCpY = null;
    } else if (L === 'H') {
      absX = r(cx, cmd.x);
      absY = cy;
      prevCpX = null; prevCpY = null;
    } else if (L === 'V') {
      absX = cx;
      absY = r(cy, cmd.y);
      prevCpX = null; prevCpY = null;
    } else if (L === 'C') {
      const cp1x = r(cx, cmd.x1), cp1y = r(cy, cmd.y1);
      const cp2x = r(cx, cmd.x2), cp2y = r(cy, cmd.y2);
      absX = r(cx, cmd.x); absY = r(cy, cmd.y);
      controls = [{ x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }];
      prevCpX = cp2x; prevCpY = cp2y;
    } else if (L === 'S') {
      const cp1x = prevCpX !== null ? 2 * cx - prevCpX : cx;
      const cp1y = prevCpY !== null ? 2 * cy - prevCpY : cy;
      const cp2x = r(cx, cmd.x2), cp2y = r(cy, cmd.y2);
      absX = r(cx, cmd.x); absY = r(cy, cmd.y);
      controls = [{ x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }];
      prevCpX = cp2x; prevCpY = cp2y;
    } else if (L === 'Q') {
      const cpx = r(cx, cmd.x1), cpy = r(cy, cmd.y1);
      absX = r(cx, cmd.x); absY = r(cy, cmd.y);
      controls = [{ x: cpx, y: cpy }];
      prevCpX = cpx; prevCpY = cpy;
    } else if (L === 'A') {
      absX = r(cx, cmd.x); absY = r(cy, cmd.y);
      prevCpX = null; prevCpY = null;
    } else if (L === 'Z') {
      absX = initX; absY = initY;
      prevCpX = null; prevCpY = null;
    }

    cx = absX; cy = absY;
    return { absX, absY, controls };
  });
}

/** Default named-prop command object for a newly appended command. */
export function defaultCmd(letter, cx, cy) {
  const L = letter.toUpperCase();
  const rel = letter !== L;
  switch (L) {
    case 'M': return rel ? { letter, x: 0, y: 0 } : { letter, x: cx, y: cy };
    case 'L': return rel ? { letter, x: 20, y: 0 } : { letter, x: cx + 20, y: cy };
    case 'H': return rel ? { letter, x: 20 } : { letter, x: cx + 20 };
    case 'V': return rel ? { letter, y: 20 } : { letter, y: cy + 20 };
    case 'C': return rel
      ? { letter, x1: 10, y1: -20, x2: 30, y2: -20, x: 40, y: 0 }
      : { letter, x1: cx + 10, y1: cy - 20, x2: cx + 30, y2: cy - 20, x: cx + 40, y: cy };
    case 'S': return rel
      ? { letter, x2: 20, y2: -20, x: 40, y: 0 }
      : { letter, x2: cx + 20, y2: cy - 20, x: cx + 40, y: cy };
    case 'Q': return rel
      ? { letter, x1: 20, y1: -20, x: 40, y: 0 }
      : { letter, x1: cx + 20, y1: cy - 20, x: cx + 40, y: cy };
    case 'T': return rel ? { letter, x: 40, y: 0 } : { letter, x: cx + 40, y: cy };
    case 'A': return rel
      ? { letter, rx: 20, ry: 20, 'x-axis-rotation': 0, 'large-arc-flag': 0, 'sweep-flag': 1, x: 40, y: 0 }
      : { letter, rx: 20, ry: 20, 'x-axis-rotation': 0, 'large-arc-flag': 0, 'sweep-flag': 1, x: cx + 40, y: cy };
    case 'Z': return { letter };
    default:  return { letter };
  }
}

// --- Internal helpers ---

function makeCmd(letter, keys, vals) {
  const cmd = { letter };
  keys.forEach((k, i) => { cmd[k] = vals[i]; });
  return cmd;
}

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

function readVals(tokens, start, count) {
  const vals = [];
  let i = start;
  while (vals.length < count && i < tokens.length && isNumber(tokens[i])) {
    vals.push(parseFloat(tokens[i++]));
  }
  return vals;
}

function formatNum(n) {
  if (!isFinite(n)) return '0';
  const s = n.toFixed(4);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
