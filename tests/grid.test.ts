import { describe, expect, it, vi } from 'vitest';
import { HOUR_COUNT } from '../src/config';
import { renderGrid } from '../src/grid';
import { createSchedule, normalizeLesson } from '../src/model';

describe('renderGrid', () => {
  it('renders one clickable slot per whole hour per day', () => {
    const onSlotClick = vi.fn();
    const grid = renderGrid(createSchedule('Bc1JCF1'), { onSlotClick, onLessonClick: vi.fn() });
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
    const grid = renderGrid(schedule, { onSlotClick: vi.fn(), onLessonClick });
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
