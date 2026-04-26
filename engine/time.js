export function nlNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function timeStr(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function season(d) {
  const m = d.getMonth() + 1;
  if (m <= 2 || m === 12) return 'winter';
  if (m <= 5)             return 'spring';
  if (m <= 8)             return 'summer';
  return 'autumn';
}

export function isWeekend(d) {
  return d.getDay() === 0 || d.getDay() === 6;
}

export function dayKey(d) {
  if (d.getDay() === 6) return 'saturday';
  if (d.getDay() === 0) return 'sunday';
  return 'weekdays';
}

export function buildingDayKey(d) {
  if (d.getDay() === 6) return 'sat';
  if (d.getDay() === 0) return 'sun';
  return 'mon-fri';
}

// range: "08:00-17:30", current: "HH:MM"
export function inRange(current, range) {
  if (!range) return false;
  const [open, close] = range.split('-');
  return current >= open && current < close;
}
