import { DAYS, FIRST_HOUR, HOUR_COUNT, LAST_HOUR, paletteColor } from './config';
import { h } from './dom';
import { formatHour, layoutDay, type Lesson, type Schedule } from './model';

export interface GridHandlers {
  onSlotClick(day: number, hour: number): void;
  onLessonClick(lesson: Lesson): void;
}

const BASE_ROW_HEIGHT = 64;
const LANE_MIN_HEIGHT = 32;

function pct(hours: number): string {
  return `${(hours / HOUR_COUNT) * 100}%`;
}

export function lessonLabel(lesson: Lesson): string {
  const parts = [
    lesson.subject || 'Bez názvu',
    `${DAYS[lesson.day]} ${formatHour(lesson.start)}–${formatHour(lesson.start + lesson.duration)}`,
    lesson.room && `učebna ${lesson.room}`,
    lesson.lecturer && `vyučující ${lesson.lecturer}`,
  ];
  return parts.filter(Boolean).join(', ');
}

function renderLesson(lesson: Lesson, lane: number, lanes: number, handlers: GridHandlers): HTMLElement {
  const color = paletteColor(lesson.color);
  const el = h(
    'button',
    {
      type: 'button',
      class: `lesson${lanes > 1 ? ' lesson--compact' : ''}`,
      'data-lesson-id': lesson.id,
      'aria-label': `Upravit: ${lessonLabel(lesson)}`,
      title: lessonLabel(lesson),
      style: [
        `left:${pct(lesson.start - FIRST_HOUR)}`,
        `width:${pct(lesson.duration)}`,
        `top:${(lane / lanes) * 100}%`,
        `height:${100 / lanes}%`,
        `--fill:${color.fill}`,
        `--border:${color.border}`,
      ].join(';'),
    },
    h('span', { class: 'lesson-title' }, lesson.subject || '—'),
    h(
      'span',
      { class: 'lesson-meta' },
      h('span', { class: 'lesson-lecturer' }, lesson.lecturer),
      h('span', { class: 'lesson-room' }, lesson.room),
    ),
  );
  el.addEventListener('click', () => handlers.onLessonClick(lesson));
  return el;
}

export function renderGrid(schedule: Schedule, handlers: GridHandlers): HTMLElement {
  const hourLabels: HTMLElement[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    hourLabels.push(h('span', { class: 'hour-label', style: `left:${pct(hour - FIRST_HOUR)}` }, formatHour(hour)));
  }

  const board = h(
    'div',
    { class: 'board', role: 'grid', 'aria-label': 'Rozvrh' },
    h(
      'div',
      { class: 'board-head', role: 'row' },
      h('div', { class: 'corner', role: 'columnheader' }, schedule.specId || '—'),
      h('div', { class: 'hours', 'aria-hidden': 'true' }, ...hourLabels),
    ),
  );

  DAYS.forEach((dayName, day) => {
    const placed = layoutDay(schedule.lessons.filter((l) => l.day === day));
    const maxLanes = placed.reduce((m, p) => Math.max(m, p.lanes), 1);
    const height = Math.max(BASE_ROW_HEIGHT, maxLanes * LANE_MIN_HEIGHT);

    const track = h('div', { class: 'track', 'data-day': day, style: `--cols:${HOUR_COUNT}` });
    for (let hour = FIRST_HOUR; hour < LAST_HOUR; hour++) {
      const slot = h(
        'button',
        {
          type: 'button',
          class: 'slot',
          'data-day': day,
          'data-hour': hour,
          'aria-label': `Přidat hodinu: ${dayName} ${formatHour(hour)}`,
        },
        h('span', { 'aria-hidden': 'true' }, '+'),
      );
      slot.addEventListener('click', () => handlers.onSlotClick(day, hour));
      track.append(slot);
    }
    for (const p of placed) track.append(renderLesson(p.lesson, p.lane, p.lanes, handlers));

    board.append(
      h(
        'div',
        { class: 'day-row', role: 'row', style: `height:${height}px` },
        h('div', { class: 'day-label', role: 'rowheader' }, dayName),
        track,
      ),
    );
  });

  return h('div', { class: 'board-scroll' }, board);
}
