import { describe, expect, it } from 'vitest';
import { FIRST_HOUR, LAST_HOUR, PALETTE, PROGRAMS, canonicalSpecId, formatSpecId, parseSpecId } from '../src/config';
import { layoutDay, maxDuration, normalizeLesson, normalizeSchedule, type Lesson } from '../src/model';

const lesson = (id: string, start: number, duration: number, day = 0): Lesson => ({
  id,
  day,
  start,
  duration,
  subject: id,
  room: '',
  lecturer: '',
  color: 'green',
});

describe('normalizeLesson', () => {
  it('forces lessons to start on a whole hour', () => {
    expect(normalizeLesson({ start: 12.5, duration: 2 }).start).toBe(12);
    expect(normalizeLesson({ start: '10' as unknown as number }).start).toBe(10);
  });

  it('keeps the start inside the visible grid', () => {
    expect(normalizeLesson({ start: 3 }).start).toBe(FIRST_HOUR);
    expect(normalizeLesson({ start: 23 }).start).toBe(LAST_HOUR - 1);
    expect(normalizeLesson({ start: Number.NaN }).start).toBe(FIRST_HOUR);
  });

  it('clamps the duration so the lesson ends by the last hour', () => {
    expect(normalizeLesson({ start: 18, duration: 5 }).duration).toBe(2);
    expect(normalizeLesson({ start: 9, duration: 0 }).duration).toBe(1);
    expect(normalizeLesson({ start: 9, duration: 2.9 }).duration).toBe(2);
    expect(maxDuration(19)).toBe(1);
  });

  it('falls back to a palette colour and trims text', () => {
    const l = normalizeLesson({ color: 'hotpink', subject: '  MAN  ', room: 'x'.repeat(200) });
    expect(PALETTE.some((c) => c.id === l.color)).toBe(true);
    expect(l.subject).toBe('MAN');
    expect(l.room).toHaveLength(80);
  });

  it('clamps the day to Monday–Friday', () => {
    expect(normalizeLesson({ day: 7 }).day).toBe(4);
    expect(normalizeLesson({ day: -1 }).day).toBe(0);
  });
});

describe('normalizeSchedule', () => {
  it('rejects non-objects and repairs lessons', () => {
    expect(normalizeSchedule(null)).toBeNull();
    expect(normalizeSchedule('x')).toBeNull();
    const s = normalizeSchedule({ specId: 'Bc1JCF1', lessons: [{ start: 10.5, duration: 1 }, 'junk', null] });
    expect(s?.specId).toBe('JCF1'); // year dropped, as on the official timetable
    expect(s?.lessons).toHaveLength(1);
    expect(s?.lessons[0]?.start).toBe(10);
  });
});

describe('program and kruh IDs', () => {
  it('lists programs alphabetically, with valid codes', () => {
    const names = PROGRAMS.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'cs')));
    for (const p of PROGRAMS) {
      expect(p.code).toMatch(/^[A-Z_]+$/);
      expect(p.name).not.toMatch(/kruh|ročník/i);
      expect(p.groups).toBeGreaterThanOrEqual(1);
    }
  });

  it('parses official, short and single-kruh IDs', () => {
    expect(parseSpecId('Bc1JCF2')).toMatchObject({ program: { code: 'JCF' }, group: 2 });
    expect(parseSpecId('jcf3')).toMatchObject({ program: { code: 'JCF' }, group: 3 });
    expect(parseSpecId('FI_IPL')).toMatchObject({ program: { code: 'FI_IPL' }, group: 1 });
    expect(parseSpecId('Bc2FI_IPL1')).toMatchObject({ program: { code: 'FI_IPL' }, group: 1 });
    expect(parseSpecId('JCF4')).toBeNull(); // no such kruh
    expect(parseSpecId('FI')).toBeNull();
    expect(parseSpecId('')).toBeNull();
  });

  it('formats the ID like the official timetable corner', () => {
    const jcf = PROGRAMS.find((p) => p.code === 'JCF')!;
    const ipl = PROGRAMS.find((p) => p.code === 'FI_IPL')!;
    expect(formatSpecId(jcf, 1)).toBe('JCF1');
    expect(formatSpecId(ipl, 1)).toBe('FI_IPL');
    expect(canonicalSpecId('Bc1JI_JR4')).toBe('JI_JR4');
    expect(canonicalSpecId(' vlastní ')).toBe('vlastní');
  });
});

describe('layoutDay', () => {
  it('keeps non-overlapping lessons in a single lane', () => {
    const placed = layoutDay([lesson('a', 8, 2), lesson('b', 10, 2)]);
    expect(placed.map((p) => [p.lesson.id, p.lane, p.lanes])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  it('stacks parallel lessons into lanes', () => {
    const placed = layoutDay([lesson('a', 14, 2), lesson('b', 14, 2), lesson('c', 16, 2)]);
    const byId = Object.fromEntries(placed.map((p) => [p.lesson.id, p]));
    expect(byId.a?.lanes).toBe(2);
    expect(byId.b?.lanes).toBe(2);
    expect(new Set([byId.a?.lane, byId.b?.lane])).toEqual(new Set([0, 1]));
    expect(byId.c?.lanes).toBe(1);
  });

  it('reuses freed lanes inside one overlap group', () => {
    const placed = layoutDay([lesson('long', 8, 4), lesson('x', 8, 1), lesson('y', 9, 1)]);
    const byId = Object.fromEntries(placed.map((p) => [p.lesson.id, p]));
    expect(byId.long?.lanes).toBe(2);
    expect(byId.x?.lane).toBe(byId.y?.lane);
  });
});

describe('palette', () => {
  it('has one colour per FJFI department, with unique abbreviations and code prefixes', () => {
    expect(PALETTE.map((c) => c.dept)).toEqual(['KM', 'KF', 'KHVJ', 'KIPL', 'KLFF', 'KMAT', 'KJCH', 'KDAIZ', 'KJR', 'KSI']);
    expect(new Set(PALETTE.map((c) => c.code)).size).toBe(PALETTE.length);
    expect(new Set(PALETTE.map((c) => c.id)).size).toBe(PALETTE.length);
  });
});
