/**
 * Recognises the layout of an official rozvrh.fjfi.cvut.cz timetable image
 * (the published PNG, a rendered page of the published PDF, or a screenshot
 * of either at any zoom level).
 *
 * All official images come from one generator. At 800 px wide:
 * - the grid frame's horizontal lines run from x=14 to x=738,
 * - 8:00 sits at x=114 and every hour is 50 px wide (20:00 at x=714),
 * - each day row is 50 px tall and the bottom frame line is at y=307,
 * - a lesson block has 2 px borders and a white strip with the lecturer
 *   (left) and room (right) at its bottom.
 * Everything below is expressed in those template units times a scale `s`.
 */
import { DAYS, FIRST_HOUR, HOUR_COUNT, PALETTE } from '../config';
import { colorDistance, hexToRgb, luma, pixel, type Raster, type Rect, type Rgb } from './raster';

const T = {
  frameWidth: 725,
  firstHourOffset: 100,
  hourW: 50,
  rowH: 50,
  border: 2,
} as const;

export interface Geometry {
  /** Template scale factor (1 = the 800 px wide official PNG). */
  s: number;
  /** x of the frame's left end. */
  left: number;
  /** y of the bottom frame line. */
  bottom: number;
}

export function hourX(g: Geometry, hourIndex: number): number {
  return g.left + (T.firstHourOffset + T.hourW * hourIndex) * g.s;
}

export function rowTop(g: Geometry, day: number): number {
  return g.bottom - (DAYS.length - day) * T.rowH * g.s;
}

function isGridLine([r, g, b]: Rgb): boolean {
  return r >= 200 && r <= 238 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8;
}

/**
 * Finds the grid by its bottom frame line: the lowest of the longest light
 * grey horizontal lines. Returns null when the image does not look like an
 * official timetable.
 */
export function detectGeometry(r: Raster): Geometry | null {
  const runs: Array<{ y: number; start: number; len: number }> = [];
  let best = 0;
  for (let y = 0; y < r.height; y++) {
    let start = -1;
    let gap = 0;
    let rowBest = { start: 0, len: 0 };
    for (let x = 0; x <= r.width; x++) {
      const on = x < r.width && isGridLine(pixel(r, x, y));
      if (on) {
        if (start < 0) start = x;
        gap = 0;
      } else if (start >= 0) {
        // Tolerate a 1 px break (anti-aliasing in screenshots).
        if (x < r.width && ++gap <= 1) continue;
        const len = x - gap - start;
        if (len > rowBest.len) rowBest = { start, len };
        start = -1;
        gap = 0;
      }
    }
    runs.push({ y, ...rowBest });
    best = Math.max(best, rowBest.len);
  }
  if (best < 200) return null;
  const candidates = runs.filter((run) => run.len >= best * 0.97);
  const bottomRun = candidates[candidates.length - 1]!;
  const s = bottomRun.len / T.frameWidth;
  const g: Geometry = { s, left: bottomRun.start, bottom: bottomRun.y };
  if (rowTop(g, 0) < 0 || hourX(g, HOUR_COUNT) > r.width + 2) return null;
  return g;
}

interface PaletteRef {
  id: string;
  rgb: Rgb;
}

function tint([r, g, b]: Rgb, amount: number): Rgb {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount].map(Math.round) as Rgb;
}

/** Fill, border and lighter edge shades seen on the official images, per palette colour. */
const PALETTE_REFS: PaletteRef[] = [
  ...PALETTE.flatMap((c) => [
    { id: c.id, rgb: hexToRgb(c.fill) },
    { id: c.id, rgb: hexToRgb(c.border) },
    // Side and bottom edges are drawn slightly lighter than the fill.
    { id: c.id, rgb: tint(hexToRgb(c.fill), 0.15) },
  ]),
  // The official PDFs draw fills semi-transparent, so they render ~25 %
  // lighter. (Not for grey: a lighter grey would match the grid lines.)
  ...PALETTE.filter((c) => c.id !== 'grey').map((c) => ({ id: c.id, rgb: tint(hexToRgb(c.fill), 0.25) })),
  // Darker grey used for parallel blocks (e.g. MAM1/MAM2).
  { id: 'grey', rgb: hexToRgb('#bbbbbb') },
  { id: 'grey', rgb: hexToRgb('#a7a7a7') },
];

export function classifyColor(rgb: Rgb, tolerance = 22): string | null {
  let bestId: string | null = null;
  let bestD = tolerance;
  for (const ref of PALETTE_REFS) {
    const d = colorDistance(rgb, ref.rgb);
    if (d < bestD) {
      bestD = d;
      bestId = ref.id;
    }
  }
  return bestId;
}

const isWhite = ([r, g, b]: Rgb) => r > 238 && g > 238 && b > 238;

export interface DetectedBlock {
  day: number;
  /** Whole hour the block starts at. */
  start: number;
  duration: number;
  color: string;
  lane: number;
  lanes: number;
  /** Where the subject title is drawn. */
  titleRect: Rect;
  /** The white strip with lecturer (left) and room (right). */
  metaRect: Rect;
}

interface Cell {
  top: number;
  stripTop: number;
  stripBottom: number;
  bottom: number;
  color: string;
  lane: number;
  lanes: number;
}

type Kind = string | 'white' | 'other';

/** Offsets (template px) inside an hour column where vertical scans are taken. */
const SCAN_OFFSETS = [3, 10, 17, 25, 33, 40, 47];

/**
 * Classifies one vertical line of a day row. Of several candidate lines in
 * the hour column, the one with the fewest changes of kind (i.e. crossing the
 * least text) is used, so centred titles and the white insides of letters do
 * not disturb the colour and lane detection.
 */
function cleanestScan(r: Raster, g: Geometry, yTop: number, yBottom: number, hourIndex: number): Kind[] {
  let best: Kind[] = [];
  let bestScore = Infinity;
  for (const offset of SCAN_OFFSETS) {
    const x = hourX(g, hourIndex) + Math.max(3, offset * g.s);
    const kinds: Kind[] = [];
    let changes = 0;
    let other = 0;
    for (let y = yTop; y <= yBottom; y++) {
      const rgb = pixel(r, x, y);
      const kind = classifyColor(rgb) ?? (isWhite(rgb) ? 'white' : 'other');
      if (kind === 'other') other++;
      if (kinds.length > 0 && kinds[kinds.length - 1] !== kind) changes++;
      kinds.push(kind);
    }
    const score = changes * 1000 + other;
    if (score < bestScore) {
      best = kinds;
      bestScore = score;
    }
  }
  return best;
}

/** Splits one hour column of one day row into lesson cells. */
function columnCells(r: Raster, g: Geometry, day: number, hourIndex: number): Cell[] {
  const yTop = Math.round(rowTop(g, day));
  const yBottom = Math.round(rowTop(g, day + 1)) - 1;
  const kinds = cleanestScan(r, g, yTop, yBottom, hourIndex);
  const isColor = (k: string | undefined) => k !== undefined && k !== 'white' && k !== 'other';

  const cells: Cell[] = [];
  const rowH = T.rowH * g.s;
  const border = Math.max(1, Math.round(T.border * g.s));
  const minStrip = Math.max(4, 5 * g.s);
  let i = 0;
  while (i < kinds.length) {
    // A cell starts with its coloured top border…
    while (i < kinds.length && !isColor(kinds[i])) i++;
    if (i >= kinds.length) break;
    const top = i;
    const votes = new Map<string, number>();
    // …and its white lecturer/room strip is the first white run that is long
    // enough and directly followed by the coloured bottom border. Shorter
    // white runs are the insides of title letters.
    let stripTop = -1;
    let stripEnd = -1;
    let j = top;
    while (j < kinds.length) {
      const k = kinds[j]!;
      if (k === 'white') {
        let end = j;
        while (end < kinds.length && kinds[end] === 'white') end++;
        if (end - j >= minStrip && isColor(kinds[end])) {
          stripTop = j;
          stripEnd = end;
          break;
        }
        j = end;
        continue;
      }
      if (isColor(k)) votes.set(k, (votes.get(k) ?? 0) + 1);
      j++;
    }
    if (stripTop < 0 || votes.size === 0) break;
    const stripBottom = stripEnd - 1;
    let bottom = stripEnd;
    while (bottom + 1 < kinds.length && bottom + 1 < stripEnd + border && isColor(kinds[bottom + 1])) bottom++;
    i = bottom + 1;
    const color = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const height = bottom - top + 1;
    const lanes = Math.min(4, Math.max(1, Math.round(rowH / height)));
    const lane = Math.min(lanes - 1, Math.max(0, Math.round(top / (rowH / lanes))));
    cells.push({ top: yTop + top, stripTop: yTop + stripTop, stripBottom: yTop + stripBottom, bottom: yTop + bottom, color, lane, lanes });
  }
  return cells;
}

/**
 * True when a new block begins at the hour line. Inside the white
 * lecturer/room strip a continuous block is white across the line, while two
 * neighbouring blocks show their coloured side borders on both sides of it.
 */
function isBoundary(r: Raster, g: Geometry, hourIndex: number, cell: Cell): boolean {
  const xh = hourX(g, hourIndex);
  const near = Math.max(1, g.s);
  let bordered = 0;
  let rows = 0;
  for (let y = cell.stripTop; y <= cell.stripBottom; y++) {
    rows++;
    if (classifyColor(pixel(r, xh - near, y)) && classifyColor(pixel(r, xh + near, y))) bordered++;
  }
  return rows > 0 && bordered / rows >= 0.6;
}

/** Detects every lesson block on an official timetable image. */
export function detectBlocks(r: Raster, g: Geometry): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  const inset = Math.max(2, 3 * g.s);
  for (let day = 0; day < DAYS.length; day++) {
    let open: Array<DetectedBlock & { cell: Cell }> = [];
    for (let c = 0; c < HOUR_COUNT; c++) {
      const next: typeof open = [];
      for (const cell of columnCells(r, g, day, c)) {
        const prev = open.find(
          (b) => b.lane === cell.lane && b.lanes === cell.lanes && b.color === cell.color && Math.abs(b.cell.top - cell.top) <= 2 * g.s + 1,
        );
        if (prev && !isBoundary(r, g, c, cell)) {
          prev.duration++;
          next.push(prev);
          continue;
        }
        const block = {
          day,
          start: FIRST_HOUR + c,
          duration: 1,
          color: cell.color,
          lane: cell.lane,
          lanes: cell.lanes,
          titleRect: { x: 0, y: 0, w: 0, h: 0 },
          metaRect: { x: 0, y: 0, w: 0, h: 0 },
          cell,
        };
        blocks.push(block);
        next.push(block);
      }
      open = next;
    }
  }
  for (const b of blocks as Array<DetectedBlock & { cell?: Cell }>) {
    const cell = b.cell!;
    const x0 = hourX(g, b.start - FIRST_HOUR) + inset;
    const x1 = hourX(g, b.start - FIRST_HOUR + b.duration) - inset;
    b.titleRect = { x: x0, y: cell.top + T.border * g.s, w: x1 - x0, h: cell.stripTop - cell.top - (T.border + 1.5) * g.s };
    b.metaRect = { x: x0, y: cell.stripTop, w: x1 - x0, h: cell.stripBottom - cell.stripTop + 1 };
    delete b.cell;
  }
  return blocks;
}

/** Region holding the schedule's short ID in the top-left corner (e.g. "JCF1"). */
export function specIdRect(g: Geometry): Rect {
  const top = Math.max(0, rowTop(g, 0) - 40 * g.s);
  return { x: g.left, y: top, w: (T.firstHourOffset - 20) * g.s, h: rowTop(g, 0) - top - 4 * g.s };
}

/**
 * Splits the white lecturer/room strip at its widest gap between text
 * clusters. Returns the lecturer (left) and room (right) regions; either may
 * be null when absent.
 */
export function splitMetaStrip(r: Raster, rect: Rect, s: number): { lecturer: Rect | null; room: Rect | null } {
  const x0 = Math.round(rect.x);
  const x1 = Math.round(rect.x + rect.w);
  const inkCols: boolean[] = [];
  for (let x = x0; x < x1; x++) {
    let ink = false;
    for (let y = Math.round(rect.y); y < rect.y + rect.h && !ink; y++) ink = luma(pixel(r, x, y)) < 170;
    inkCols.push(ink);
  }
  const clusters: Array<[number, number]> = [];
  const minGap = Math.max(3, 4 * s);
  let start = -1;
  let lastInk = -Infinity;
  inkCols.forEach((ink, i) => {
    if (!ink) return;
    if (start < 0) start = i;
    else if (i - lastInk > minGap) {
      clusters.push([start, lastInk]);
      start = i;
    }
    lastInk = i;
  });
  if (start >= 0) clusters.push([start, lastInk]);
  const toRect = ([a, b]: [number, number]): Rect => ({ x: x0 + a - 1, y: rect.y, w: b - a + 3, h: rect.h });
  if (clusters.length === 0) return { lecturer: null, room: null };
  if (clusters.length === 1) {
    const [a, b] = clusters[0]!;
    // Lecturer names are left-aligned, rooms right-aligned.
    const nearRight = inkCols.length - 1 - b < a;
    return nearRight ? { lecturer: null, room: toRect([a, b]) } : { lecturer: toRect([a, b]), room: null };
  }
  let split = 0;
  let widest = -1;
  for (let i = 0; i < clusters.length - 1; i++) {
    const gap = clusters[i + 1]![0] - clusters[i]![1];
    if (gap > widest) {
      widest = gap;
      split = i;
    }
  }
  return {
    lecturer: toRect([clusters[0]![0], clusters[split]![1]]),
    room: toRect([clusters[split + 1]![0], clusters[clusters.length - 1]![1]]),
  };
}
