import { addDays, dayKeyOf, daysBetween, isoWeekKey, parseDayKey, weekdayOf } from './dates';

describe('dates', () => {
  it('formats local calendar days with zero padding', () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKeyOf(new Date(2026, 10, 30, 0, 1))).toBe('2026-11-30');
  });

  it('parses a day key back to local midnight', () => {
    const d = parseDayKey('2026-03-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    // Across a DST change the result is still whole days.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('returns the weekday of a key', () => {
    expect(weekdayOf('2026-10-13')).toBe(2); // Tuesday
    expect(weekdayOf('2026-10-18')).toBe(0); // Sunday
  });

  it('builds ISO week keys, including year rollovers', () => {
    expect(isoWeekKey('2026-10-13')).toBe('2026-W42');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
  });
});
