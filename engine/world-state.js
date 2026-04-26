import { nlNow, isoDate, timeStr, season, isWeekend, dayKey, buildingDayKey, inRange } from './time.js';

export async function buildWorldState() {
  const [ships, buildings, npcs, events] = await Promise.all([
    fetch('./data/ships.json').then(r => r.json()),
    fetch('./data/buildings.json').then(r => r.json()),
    fetch('./data/npcs.json').then(r => r.json()),
    fetch('./data/events.json').then(r => r.json()),
  ]);

  const now     = nlNow();
  const today   = isoDate(now);
  const time    = timeStr(now);
  const weekend = isWeekend(now);
  const bDay    = buildingDayKey(now);
  const nDay    = dayKey(now);

  const shipsInPort  = ships.ships.filter(s => s.arrives <= today && s.departs >= today);
  const shipIds      = shipsInPort.map(s => s.id);
  const activeEvents = events.events.filter(e => e.date === today);
  const isHoliday    = activeEvents.some(e => e.type === 'holiday');

  const openBuildings = buildings.buildings
    .filter(b => {
      if (isHoliday)                         return false;
      if (b['closed-dates'].includes(today)) return false;
      return inRange(time, b.hours?.[bDay]);
    })
    .map(b => b.id);

  const activeNpcs = {};
  for (const npc of npcs.npcs) {
    if (!inRange(time, npc.schedule?.[nDay]))                                   continue;
    if (npc['away-when'].includes('ship-out-of-port') && shipIds.length === 0) continue;
    if (npc['away-when'].includes('ship-in-port')     && shipIds.length > 0)   continue;
    (activeNpcs[npc.building] ??= []).push(npc.id);
  }

  return { now, today, time, season: season(now), isWeekend: weekend, shipsInPort: shipIds, openBuildings, activeNpcs, activeEvents };
}
