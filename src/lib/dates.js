// Dates from the API are plain YYYY-MM-DD calendar days, handled in UTC so the
// browser timezone can never shift them.

const asDate = (value) => new Date(`${value}T00:00:00.000Z`);

const pad = (value) => String(value).padStart(2, '0');

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function slashDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export const weekday = (value) => WEEKDAY.format(asDate(value));
export const shortDate = (value) => SHORT.format(asDate(value));
export const longDate = (value) => LONG.format(asDate(value));
export const monthLabel = (year, month) => MONTH.format(new Date(Date.UTC(year, month, 1)));

export function dayRange(from, to) {
  return from === to ? slashDate(from) : `${slashDate(from)} to ${slashDate(to)}`;
}

export function shortRange(from, to) {
  return from === to ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
}

export function toDayString(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function monthKey(year, month) {
  return `${year}-${pad(month + 1)}`;
}

// Weeks for a month grid, Monday first, with null for days outside the month.
export function monthGrid(year, month) {
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells = Array(firstWeekday).fill(null);
  for (let day = 1; day <= total; day += 1) cells.push(toDayString(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// A moment in time, shown as the calendar day it was where the reader is.
export const isoFromCreatedAt = (value) => new Intl.DateTimeFormat('en-CA').format(new Date(value));

export const dayWord = (count) => (count === 1 ? 'day' : 'days');

// "Good morning" before noon, "Good afternoon" until 5 in the evening, then
// "Good evening", by the reader's own clock.
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}
