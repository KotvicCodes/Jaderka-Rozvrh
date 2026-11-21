import { DAYS, FIRST_HOUR, HOUR_COUNT, LAST_HOUR, paletteColor } from './config';
import { formatHour, layoutDay, type Lesson, type Schedule } from './model';

/**
 * Geometry of the exported image, in CSS pixels (scaled up when rasterising).
 * Mirrors the board on the page (.board in style.css): square hour cells
 * (hourW = rowH), 8 px padding, a 32 px header and 36 px right of the grid
 * for the "20:00" label.
 */
export const EXPORT = {
  padX: 8,
  labelW: 120,
  hourW: 64,
  /** Room right of 20:00 for its label (centred on the last line). */
  rightPad: 36,
  /** 8 px top padding + the 32 px header row. */
  headerH: 40,
  rowH: 64,
  laneMinH: 32,
  bottomPad: 12,
} as const;

/** Text sizes of the page (rem × 16 px), so the export reads the same. */
const TEXT = {
  corner: 13.6,
  hour: 12.8,
  day: 13.6,
  title: 13.6,
  titleCompact: 10.9,
  meta: 9.9,
  metaCompact: 9.3,
};

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
    rows.push({ day, x: EXPORT.padX, y, w: EXPORT_WIDTH - EXPORT.padX - EXPORT.rightPad, h: rowH });
    for (const p of placed) {
      const laneH = rowH / p.lanes;
      lessons.push({
        lesson: p.lesson,
        compact: p.lanes > 1,
        // Like on the page: a block fills its cells, so neighbouring
        // lessons touch and a lesson spans the full row (below its line).
        rect: {
          x: hourX(p.lesson.start),
          y: y + p.lane * laneH + 1,
          w: hourX(p.lesson.start + p.lesson.duration) - hourX(p.lesson.start),
          h: laneH - 1,
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
  const border = 2;
  const metaSize = compact ? TEXT.metaCompact : TEXT.meta;
  // White strip for lecturer and room: one line (line-height 1.25 / 1.1) + 2 px padding, inside the border.
  const metaH = Math.round(metaSize * (compact ? 1.1 : 1.25) + 2);
  const inner = { x: r.x + border, y: r.y + border, w: r.w - 2 * border, h: r.h - 2 * border };

  ctx.fillStyle = color.fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(inner.x, inner.y + inner.h - metaH, inner.w, metaH);
  ctx.strokeStyle = color.border;
  ctx.lineWidth = border;
  ctx.strokeRect(r.x + border / 2, r.y + border / 2, r.w - border, r.h - border);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${compact ? TEXT.titleCompact : TEXT.title}px ${FONT}`;
  const title = fitText(ctx, lesson.subject, inner.w - 8);
  const titleY = inner.y + (inner.h - metaH) / 2;
  // White halo around the title, as on the official timetable.
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = compact ? 2.5 : 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(title, r.x + r.w / 2, titleY);
  ctx.restore();
  ctx.fillText(title, r.x + r.w / 2, titleY);

  ctx.font = `${metaSize}px ${FONT}`;
  const metaY = inner.y + inner.h - metaH / 2;
  const roomW = Math.min(ctx.measureText(lesson.room).width, inner.w / 2 - 4);
  ctx.textAlign = 'right';
  ctx.fillText(fitText(ctx, lesson.room, inner.w / 2 - 4), inner.x + inner.w - 4, metaY);
  ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, lesson.lecturer, inner.w - roomW - 12), inner.x + 4, metaY);
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
  const headerY = 8 + (EXPORT.headerH - 8) / 2;
  ctx.font = `bold ${TEXT.corner}px ${FONT}`;
  ctx.fillText(fitText(ctx, schedule.specId, EXPORT.labelW - 20), EXPORT.padX, headerY);
  ctx.font = `${TEXT.hour}px ${FONT}`;
  ctx.textAlign = 'center';
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) ctx.fillText(formatHour(hour), layout.hourX(hour), headerY);

  // Grid lines.
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const x = Math.round(layout.hourX(hour)) + 0.5;
    ctx.moveTo(x, grid.y);
    ctx.lineTo(x, grid.y + grid.h);
  }
  for (const row of layout.rows) {
    ctx.moveTo(row.x, Math.round(row.y) + 0.5);
    ctx.lineTo(row.x + row.w, Math.round(row.y) + 0.5);
  }
  const bottom = Math.round(grid.y + grid.h) + 0.5;
  ctx.moveTo(EXPORT.padX, bottom);
  ctx.lineTo(EXPORT_WIDTH - EXPORT.rightPad, bottom);
  ctx.stroke();

  // Day labels.
  ctx.fillStyle = '#000000';
  ctx.font = `${TEXT.day}px ${FONT}`;
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
