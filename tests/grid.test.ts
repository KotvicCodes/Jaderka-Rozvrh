import { describe, expect, it, vi } from 'vitest';
import { HOUR_COUNT } from '../src/config';
import { dropStart, renderGrid } from '../src/grid';
import { createSchedule, normalizeLesson } from '../src/model';

describe('renderGrid', () => {
  it('renders one clickable slot per whole hour per day', () => {
    const onSlotClick = vi.fn();
    const grid = renderGrid(createSchedule('Bc1JCF1'), { onSlotClick, onLessonClick: vi.fn(), onLessonMove: vi.fn() });
    const slots = grid.querySelectorAll<HTMLButtonElement>('.slot');
    expect(slots).toHaveLength(5 * HOUR_COUNT);
    slots[HOUR_COUNT + 2]!.click();
    expect(onSlotClick).toHaveBeenCalledWith(1, 10);
    expect(grid.querySelector('.corner')?.textContent).toBe('Bc1JCF1');
  });

  it('positions lessons by start and duration and shows their details as text', () => {
    const schedule = createSchedule();
    const lesson = normalizeLesson({ day: 2, start: 12, duration: 3, subject: '<b>MAN</b>', room: 'B-103', lecturer: 'Strachota', color: 'pink' });
    schedule.lessons.push(lesson);
    const onLessonClick = vi.fn();
    const grid = renderGrid(schedule, { onSlotClick: vi.fn(), onLessonClick, onLessonMove: vi.fn() });
    const el = grid.querySelector<HTMLElement>('.track[data-day="2"] .lesson')!;
    expect(el.style.left).toBe(`${(4 / HOUR_COUNT) * 100}%`);
    expect(el.style.width).toBe(`${(3 / HOUR_COUNT) * 100}%`);
    expect(el.querySelector('.lesson-title')?.textContent).toBe('<b>MAN</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('.lesson-room')?.textContent).toBe('B-103');
    el.click();
    expect(onLessonClick).toHaveBeenCalledWith(lesson);
  });
});

describe('dropStart', () => {
  // Track 1200px wide → 100px per hour starting at 8:00.
  it('snaps to the whole hour under the pointer', () => {
    expect(dropStart(250, 0, 1200, 0, 1)).toBe(10);
    expect(dropStart(299, 0, 1200, 0, 1)).toBe(10);
    expect(dropStart(300, 0, 1200, 0, 1)).toBe(11);
  });

  it('keeps the grabbed hour under the pointer', () => {
    expect(dropStart(450, 0, 1200, 1, 2)).toBe(11);
  });

  it('never moves a lesson outside the grid', () => {
    expect(dropStart(-50, 0, 1200, 0, 2)).toBe(8);
    expect(dropStart(1190, 0, 1200, 0, 3)).toBe(17);
  });
});

describe('keyboard moves', () => {
  it('moves a lesson with Alt+arrows, clamped to the grid', () => {
    const schedule = createSchedule();
    const lesson = normalizeLesson({ day: 0, start: 18, duration: 2 });
    schedule.lessons.push(lesson);
    const onLessonMove = vi.fn();
    const grid = renderGrid(schedule, { onSlotClick: vi.fn(), onLessonClick: vi.fn(), onLessonMove });
    const el = grid.querySelector<HTMLElement>('.lesson')!;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }));
    expect(onLessonMove).not.toHaveBeenCalled();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    expect(onLessonMove).toHaveBeenCalledWith(lesson, 1, 18);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
    expect(onLessonMove).toHaveBeenLastCalledWith(lesson, 0, 17);
  });
});
