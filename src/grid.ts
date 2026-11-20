import { DAYS, FIRST_HOUR, HOUR_COUNT, LAST_HOUR, paletteColor } from './config';
import { h } from './dom';
import { formatHour, layoutDay, type Lesson, type Schedule } from './model';

export interface GridHandlers {
  onSlotClick(day: number, hour: number): void;
  onLessonClick(lesson: Lesson): void;
  /** Called when a lesson is dragged (or moved with Alt+arrows) to a new slot. */
  onLessonMove(lesson: Lesson, day: number, start: number): void;
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

/**
 * Whole-hour start for a lesson dropped at `pointerX` on a track, keeping the
 * grabbed hour under the pointer and the lesson inside the grid.
 */
export function dropStart(pointerX: number, trackLeft: number, trackWidth: number, grabOffset: number, duration: number): number {
  const hourUnderPointer = FIRST_HOUR + Math.floor(((pointerX - trackLeft) / trackWidth) * HOUR_COUNT);
  return Math.min(LAST_HOUR - duration, Math.max(FIRST_HOUR, hourUnderPointer - grabOffset));
}

const DRAG_THRESHOLD = 5;

function trackAt(x: number, y: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const track = el.closest<HTMLElement>('.track');
    if (track) return track;
  }
  return null;
}

function enableDrag(el: HTMLElement, lesson: Lesson, handlers: GridHandlers): void {
  let origin: { x: number; y: number; grab: number; pointerId: number } | null = null;
  let dragging = false;
  let target: { day: number; start: number } | null = null;
  let preview: HTMLElement | null = null;
  let suppressClick = false;

  const cleanup = () => {
    el.classList.remove('lesson--dragging');
    el.style.transform = '';
    preview?.remove();
    preview = null;
    origin = null;
    dragging = false;
    target = null;
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const track = el.closest<HTMLElement>('.track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const hourAtPointer = FIRST_HOUR + Math.floor(((e.clientX - rect.left) / rect.width) * HOUR_COUNT);
    origin = { x: e.clientX, y: e.clientY, grab: Math.max(0, hourAtPointer - lesson.start), pointerId: e.pointerId };
  });

  el.addEventListener('pointermove', (e) => {
    if (!origin || e.pointerId !== origin.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('lesson--dragging');
    }
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    const track = trackAt(e.clientX, e.clientY);
    if (!track) {
      preview?.remove();
      preview = null;
      target = null;
      return;
    }
    const rect = track.getBoundingClientRect();
    const start = dropStart(e.clientX, rect.left, rect.width, origin.grab, lesson.duration);
    target = { day: Number(track.dataset.day), start };
    if (!preview) preview = h('div', { class: 'drop-preview', 'aria-hidden': 'true' });
    preview.style.left = pct(start - FIRST_HOUR);
    preview.style.width = pct(lesson.duration);
    if (preview.parentElement !== track) track.append(preview);
  });

  el.addEventListener('pointerup', (e) => {
    if (!origin || e.pointerId !== origin.pointerId) return;
    if (dragging) {
      suppressClick = true;
      const t = target;
      cleanup();
      if (t && (t.day !== lesson.day || t.start !== lesson.start)) handlers.onLessonMove(lesson, t.day, t.start);
    } else {
      cleanup();
    }
  });
  el.addEventListener('pointercancel', cleanup);
  el.addEventListener('lostpointercapture', () => {
    if (dragging) cleanup();
  });

  el.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  // Keyboard alternative: Alt+←/→ moves by an hour, Alt+↑/↓ by a day.
  el.addEventListener('keydown', (e) => {
    if (!e.altKey) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const day = Math.min(DAYS.length - 1, Math.max(0, lesson.day + move[0]));
    const start = Math.min(LAST_HOUR - lesson.duration, Math.max(FIRST_HOUR, lesson.start + move[1]));
    if (day !== lesson.day || start !== lesson.start) handlers.onLessonMove(lesson, day, start);
  });
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
      'aria-keyshortcuts': 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown',
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
  enableDrag(el, lesson, handlers);
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
