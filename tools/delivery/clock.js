const DEFAULT_QJYNN_TIMEZONE = 'America/New_York';
const DATE_FORMAT_OPTIONS = Object.freeze({ timeZoneName: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

function normalizeNow(now = new Date()) { const value = now instanceof Date ? now : new Date(now); if (Number.isNaN(value.getTime())) throw new Error('Invalid clock time.'); return value; }
function dateFormatter(timezone) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
function getQjynnDate(now = new Date(), timezone = DEFAULT_QJYNN_TIMEZONE) { return dateFormatter(timezone).format(normalizeNow(now)); }
function getCurrentQjynnTime(now = new Date(), timezone = DEFAULT_QJYNN_TIMEZONE) { return { now: normalizeNow(now), timezone, date: getQjynnDate(now, timezone) }; }
function addCalendarDays(dateKey, days) { const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function nextQjynnBoundary(now = new Date(), timezone = DEFAULT_QJYNN_TIMEZONE) {
  const current = normalizeNow(now); const target = addCalendarDays(getQjynnDate(current, timezone), 1);
  let low = current.getTime(); let high = low + 48 * 60 * 60 * 1000;
  for (let i = 0; i < 40; i++) { const mid = Math.floor((low + high) / 2); if (getQjynnDate(new Date(mid), timezone) < target) low = mid + 1; else high = mid; }
  return new Date(high);
}
function createClock(options = {}) { const timezone = options.timezone || DEFAULT_QJYNN_TIMEZONE; return { timezone, now: () => normalizeNow(typeof options.now === 'function' ? options.now() : options.now || new Date()), getCurrentQjynnTime: () => getCurrentQjynnTime(typeof options.now === 'function' ? options.now() : options.now || new Date(), timezone), getCurrentPuzzleDate: () => getQjynnDate(typeof options.now === 'function' ? options.now() : options.now || new Date(), timezone), nextBoundary: () => nextQjynnBoundary(typeof options.now === 'function' ? options.now() : options.now || new Date(), timezone) }; }
module.exports = { DEFAULT_QJYNN_TIMEZONE, DATE_FORMAT_OPTIONS, normalizeNow, getQjynnDate, getCurrentQjynnTime, addCalendarDays, nextQjynnBoundary, createClock };
