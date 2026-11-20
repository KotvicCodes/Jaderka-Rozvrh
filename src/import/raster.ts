/** Plain RGBA bitmap, compatible with ImageData. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rgb = [number, number, number];

export function pixel(r: Raster, x: number, y: number): Rgb {
  const xi = Math.min(r.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(r.height - 1, Math.max(0, Math.round(y)));
  const i = (yi * r.width + xi) * 4;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!];
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Most common colour in a region (the background behind text). */
export function dominantColor(src: Raster, rect: Rect): Rgb {
  const counts = new Map<number, number>();
  let best: Rgb = [255, 255, 255];
  let bestCount = 0;
  for (let y = Math.round(rect.y); y < rect.y + rect.h; y++) {
    for (let x = Math.round(rect.x); x < rect.x + rect.w; x++) {
      const rgb = pixel(src, x, y);
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      if (n > bestCount) {
        bestCount = n;
        best = rgb;
      }
    }
  }
  return best;
}

/**
 * Shrinks `rect` to the pixels that differ clearly from its background
 * colour (the text), plus `pad` pixels. Returns null when there is no text.
 */
export function inkBounds(src: Raster, rect: Rect, pad = 1): Rect | null {
  const bg = dominantColor(src, rect);
  const cut = colorDistance(bg, [0, 0, 0]) / 2;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = Math.round(rect.y); y < rect.y + rect.h; y++) {
    for (let x = Math.round(rect.x); x < rect.x + rect.w; x++) {
      if (colorDistance(pixel(src, x, y), bg) > cut) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x0 > x1) return null;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };
}

/**
 * Crops `rect`, scales it by `factor` (bilinear) and turns it into dark text
 * on white with a white margin — the input OCR handles best. Darkness is the
 * distance from the background colour, so black or red text works on any
 * lesson colour; anti-aliasing is kept as grey for the OCR's own binarisation.
 */
export function prepareForOcr(src: Raster, rect: Rect, factor: number, bg: Rgb = dominantColor(src, rect), margin = 12): Raster {
  const full = Math.max(1, colorDistance(bg, [0, 0, 0]) * 0.8);
  const w = Math.max(1, Math.round(rect.w * factor));
  const h = Math.max(1, Math.round(rect.h * factor));
  const outW = w + 2 * margin;
  const outH = h + 2 * margin;
  const data = new Uint8ClampedArray(outW * outH * 4).fill(255);
  const sample = (x: number, y: number) => colorDistance(pixel(src, x, y), bg);
  for (let oy = 0; oy < h; oy++) {
    const sy = rect.y + (oy + 0.5) / factor - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let ox = 0; ox < w; ox++) {
      const sx = rect.x + (ox + 0.5) / factor - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const d =
        sample(x0, y0) * (1 - fx) * (1 - fy) +
        sample(x0 + 1, y0) * fx * (1 - fy) +
        sample(x0, y0 + 1) * (1 - fx) * fy +
        sample(x0 + 1, y0 + 1) * fx * fy;
      const v = Math.round(255 * (1 - Math.min(1, d / full)));
      const i = ((oy + margin) * outW + ox + margin) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: outW, height: outH, data };
}

/** True when the crop contains any dark (text) pixels. */
export function hasInk(src: Raster, rect: Rect, threshold = 140): boolean {
  for (let y = Math.round(rect.y); y < rect.y + rect.h; y++) {
    for (let x = Math.round(rect.x); x < rect.x + rect.w; x++) {
      if (luma(pixel(src, x, y)) < threshold) return true;
    }
  }
  return false;
}
