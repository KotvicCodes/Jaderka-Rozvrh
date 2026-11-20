import { DAYS, FIRST_HOUR, HOUR_COUNT, LAST_HOUR, paletteColor } from './config';
import { formatHour, layoutDay, type Lesson, type Schedule } from './model';

/**
 * Geometry of the exported image, in CSS pixels (scaled up when rasterising).
 * Hour cells are square (hourW = rowH), matching the official images.
 */
export const EXPORT = {
  padX: 16,
  labelW: 100,
  hourW: 64,
  /** Room right of 20:00 for its label. */
  rightPad: 24,
  headerH: 40,
  rowH: 64,
  laneMinH: 32,
  bottomPad: 12,
} as const;

export const EXPORT_WIDTH = EXPORT.padX + EXPORT.labelW + HOUR_COUNT * EXPORT.hourW + EXPORT.rightPad;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  grid: Rect;
  rows: Array<Rect & { day: number }>;
  hourX: (hour: number) => number;
  lessons: Array<{ lesson: Lesson; rect: Rect; compact: boolean }>;
}

/** Pure layout of the export image so it can be tested without a canvas. */
export function layoutBoard(schedule: Schedule): BoardLayout {
  const gridX = EXPORT.padX + EXPORT.labelW;
  const gridW = HOUR_COUNT * EXPORT.hourW;
  const hourX = (hour: number) => gridX + ((hour - FIRST_HOUR) / HOUR_COUNT) * gridW;

  const rows: BoardLayout['rows'] = [];
  const lessons: BoardLayout['lessons'] = [];
  let y = EXPORT.headerH;

  DAYS.forEach((_, day) => {
    const placed = layoutDay(schedule.lessons.filter((l) => l.day === day));
    const maxLanes = placed.reduce((m, p) => Math.max(m, p.lanes), 1);
    const rowH = Math.max(EXPORT.rowH, maxLanes * EXPORT.laneMinH);
    rows.push({ day, x: EXPORT.padX, y, w: EXPORT_WIDTH - EXPORT.padX - EXPORT.rightPad / 2, h: rowH });
    for (const p of placed) {
      const laneH = rowH / p.lanes;
      lessons.push({
        lesson: p.lesson,
        compact: p.lanes > 1,
        rect: {
          x: hourX(p.lesson.start) + 1,
          y: y + p.lane * laneH + 2,
          w: hourX(p.lesson.start + p.lesson.duration) - hourX(p.lesson.start) - 2,
          h: laneH - 4,
        },
      });
    }
    y += rowH;
  });

  return {
    width: EXPORT_WIDTH,
    height: y + EXPORT.bottomPad,
    grid: { x: gridX, y: EXPORT.headerH, w: gridW, h: y - EXPORT.headerH },
    rows,
    hourX,
    lessons,
  };
}

const FONT = 'Arial, Helvetica, sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function drawLesson(ctx: CanvasRenderingContext2D, lesson: Lesson, r: Rect, compact: boolean): void {
  const color = paletteColor(lesson.color);
  const metaH = compact ? 12 : 17;
  ctx.fillStyle = color.fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(r.x + 2, r.y + r.h - metaH - 1, r.w - 4, metaH - 1);
  ctx.strokeStyle = color.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${compact ? 11 : 14}px ${FONT}`;
  ctx.fillText(fitText(ctx, lesson.subject, r.w - 8), r.x + r.w / 2, r.y + (r.h - metaH) / 2 + 1);

  ctx.font = `${compact ? 9 : 10}px ${FONT}`;
  const metaY = r.y + r.h - metaH / 2 - 1;
  const roomW = Math.min(ctx.measureText(lesson.room).width, r.w / 2 - 6);
  ctx.textAlign = 'right';
  ctx.fillText(fitText(ctx, lesson.room, r.w / 2 - 6), r.x + r.w - 5, metaY);
  ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, lesson.lecturer, r.w - roomW - 14), r.x + 5, metaY);
}

/** Draws the schedule in the style of the official FJFI timetable. */
export function drawBoard(ctx: CanvasRenderingContext2D, schedule: Schedule, layout = layoutBoard(schedule)): void {
  const { grid } = layout;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Header: specialization ID and hour labels.
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(fitText(ctx, schedule.specId, EXPORT.labelW - 24), EXPORT.padX, EXPORT.headerH / 2);
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) ctx.fillText(formatHour(hour), layout.hourX(hour), EXPORT.headerH / 2);

  // Grid lines.
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const x = Math.round(layout.hourX(hour)) + 0.5;
    ctx.moveTo(x, grid.y - 6);
    ctx.lineTo(x, grid.y + grid.h);
  }
  for (const row of layout.rows) {
    ctx.moveTo(row.x, Math.round(row.y) + 0.5);
    ctx.lineTo(row.x + row.w, Math.round(row.y) + 0.5);
  }
  const bottom = Math.round(grid.y + grid.h) + 0.5;
  ctx.moveTo(EXPORT.padX, bottom);
  ctx.lineTo(EXPORT_WIDTH - EXPORT.rightPad / 2, bottom);
  ctx.stroke();

  // Day labels.
  ctx.fillStyle = '#000000';
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'left';
  for (const row of layout.rows) ctx.fillText(DAYS[row.day]!, EXPORT.padX, row.y + row.h / 2);

  for (const { lesson, rect, compact } of layout.lessons) drawLesson(ctx, lesson, rect, compact);

}

/** Rasterises the schedule to a canvas at the given pixel density. */
export function renderToCanvas(schedule: Schedule, scale: number): HTMLCanvasElement {
  const layout = layoutBoard(schedule);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D není v tomto prohlížeči dostupný.');
  ctx.scale(scale, scale);
  drawBoard(ctx, schedule, layout);
  return canvas;
}
