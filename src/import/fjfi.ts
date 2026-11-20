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
  const g = refineGeometry(r, { s, left: bottomRun.start, bottom: bottomRun.y });
  if (rowTop(g, 0) < 0 || hourX(g, HOUR_COUNT) > r.width + 2) return null;
  return g;
}

/** Centre of the strongest light grey line near `expected` along one axis. */
function locateLine(expected: number, radius: number, weight: (pos: number) => number): number | null {
  let best = 0;
  let bestPos: number | null = null;
  for (let pos = Math.round(expected - radius); pos <= Math.round(expected + radius); pos++) {
    const w = weight(pos);
    if (w > best) {
      best = w;
      bestPos = pos;
    }
  }
  if (bestPos === null) return null;
  // Thick or anti-aliased lines: take the centre of the equally strong run.
  let end = bestPos;
  while (end + 1 <= expected + radius && weight(end + 1) >= best * 0.8) end++;
  return (bestPos + end) / 2;
}

const greyness = (rgb: Rgb) => (isGridLine(rgb) || (Math.abs(rgb[0] - rgb[1]) < 8 && Math.abs(rgb[1] - rgb[2]) < 8 && rgb[0] > 160 && rgb[0] < 246) ? 255 - rgb[0] : 0);

/**
 * The bottom frame line's ends fade out in scaled screenshots, which skews
 * the first estimate. Snap to the actual 8:00 and 20:00 grid lines (visible
 * between the hour labels and Monday) and to the bottom line's centre.
 */
function refineGeometry(r: Raster, g: Geometry): Geometry {
  const bandTop = rowTop(g, 0) - 14 * g.s;
  const bandBottom = rowTop(g, 0) - 5 * g.s;
  const columnWeight = (x: number) => {
    let sum = 0;
    for (let y = Math.round(bandTop); y <= bandBottom; y++) sum += greyness(pixel(r, x, y));
    return sum;
  };
  const x8 = locateLine(hourX(g, 0), 4 * g.s, columnWeight);
  const x20 = locateLine(hourX(g, HOUR_COUNT), 4 * g.s, columnWeight);
  if (x8 === null || x20 === null) return g;
  const s = (x20 - x8) / (T.hourW * HOUR_COUNT);
  if (Math.abs(s - g.s) > 0.05 * g.s) return g;
  const left = x8 - T.firstHourOffset * s;

  const rowWeight = (y: number) => {
    let sum = 0;
    for (let x = Math.round(x8); x <= x20; x += Math.max(1, Math.round(s))) sum += greyness(pixel(r, x, y)) > 0 ? 1 : 0;
    return sum;
  };
  // The bottom frame line is never covered by lessons; use its centre.
  const bottom = locateLine(g.bottom, 2 * g.s, rowWeight) ?? g.bottom;
  return { s, left, bottom };
}

interface PaletteRef {
  id: string;
  rgb: Rgb;
}

function tint([r, g, b]: Rgb, amount: number): Rgb {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount].map(Math.round) as Rgb;
}

/**
 * Shades each palette colour can appear in. The official PNG uses the
 * palette as is, but the PDF draws fills semi-transparent, and screenshots
 * of either (browser/PDF viewer, colour management, scaling) come out paler.
 * So every fill and border colour is also matched mixed with up to 45 %
 * white. Grey only up to 12 %, since a paler grey would match the grid lines.
 */
const PALETTE_REFS: PaletteRef[] = PALETTE.flatMap((c) => {
  const grey = c.id === 'grey';
  // Darker grey used for parallel blocks (e.g. MAM1/MAM2).
  const bases = grey ? [c.fill, c.border, '#bbbbbb', '#a7a7a7'] : [c.fill, c.border];
  const maxTint = grey ? 0.12 : 0.45;
  const refs: PaletteRef[] = [];
  for (const base of bases) {
    for (let t = 0; t <= maxTint + 1e-9; t += grey ? 0.04 : 0.05) refs.push({ id: c.id, rgb: tint(hexToRgb(base), t) });
  }
  return refs;
});

const classifyCache = new Map<number, string | null>();

export function classifyColor(rgb: Rgb, tolerance = 20): string | null {
  const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
  if (tolerance === 20 && classifyCache.has(key)) return classifyCache.get(key)!;
  let bestId: string | null = null;
  let bestD = tolerance;
  for (const ref of PALETTE_REFS) {
    const d = colorDistance(rgb, ref.rgb);
    if (d < bestD) {
      bestD = d;
      bestId = ref.id;
    }
  }
  if (tolerance === 20) {
    // Bounded: a large screenshot can contain many distinct colours.
    if (classifyCache.size >= 200_000) classifyCache.clear();
    classifyCache.set(key, bestId);
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
    // Lines through blurred block edges have few changes but no white
    // lecturer strip; lines that do show a strip are preferred.
    let longestWhite = 0;
    for (let i = 0, run = 0; i < kinds.length; i++) {
      run = kinds[i] === 'white' ? run + 1 : 0;
      longestWhite = Math.max(longestWhite, run);
    }
    const hasColor = kinds.some((k) => k !== 'white' && k !== 'other');
    const missingStrip = hasColor && longestWhite < Math.max(4, 5 * g.s) ? 1 : 0;
    const score = missingStrip * 1e6 + changes * 1000 + other;
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
  // Enlarged screenshots blur the edge under the strip; sharp images don't.
  const blur = g.s >= 1.5 ? Math.round(1.5 * g.s) : 0;
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
        // Allow a blurred pixel or two between the strip and the border.
        let next = end;
        while (next < kinds.length && next - end < blur && kinds[next] === 'other') next++;
        if (end - j >= minStrip && isColor(kinds[next])) {
          stripTop = j;
          stripEnd = next;
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
 * neighbouring blocks show their coloured side borders there. The borders
 * are searched for in a small window around the line, since screenshots blur
 * them and the grid estimate can be a pixel or two off.
 */
function isBoundary(r: Raster, g: Geometry, hourIndex: number, cell: Cell): boolean {
  const xh = hourX(g, hourIndex);
  const reach = Math.max(2, 3 * g.s);
  let bordered = 0;
  let rows = 0;
  for (let y = cell.stripTop; y <= cell.stripBottom; y++) {
    rows++;
    for (let x = Math.round(xh - reach); x <= xh + reach; x++) {
      if (classifyColor(pixel(r, x, y)) === cell.color) {
        bordered++;
        break;
      }
    }
  }
  return rows > 0 && bordered / rows >= 0.6;
}

function overlapRatio(a: Cell, b: Cell): number {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + 1;
  return overlap / Math.min(a.bottom - a.top + 1, b.bottom - b.top + 1);
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
        // The same block continues if a same-coloured cell in the previous
        // hour overlaps this one vertically and no border separates them.
        const prev = open.find((b) => b.color === cell.color && !next.includes(b) && overlapRatio(b.cell, cell) >= 0.6);
        if (prev && !isBoundary(r, g, c, cell)) {
          prev.duration++;
          // Keep the measurement of the taller (less obstructed) cell.
          if (cell.bottom - cell.top > prev.cell.bottom - prev.cell.top) {
            prev.cell = cell;
            prev.lane = cell.lane;
            prev.lanes = cell.lanes;
          }
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
