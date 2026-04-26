const KEY = 'stokanker:flags';

export function getFlags()  { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
export function setFlag(id) { const f = getFlags(); f[id] = true; localStorage.setItem(KEY, JSON.stringify(f)); }
export function hasFlag(id) { return !!getFlags()[id]; }
export function resetFlags(){ localStorage.removeItem(KEY); }

export async function activeUnlocks() {
  const { unlocks } = await fetch('./content/unlocks.json').then(r => r.json());
  const flags = getFlags();
  return unlocks.filter(u =>
    (u.requires ?? []).every(f => flags[f]) &&
    (!u.any?.length || u.any.some(f => flags[f]))
  );
}
