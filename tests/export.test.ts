import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EMBED_KEY, decodePayload, encodePayload } from '../src/embed';
import { exportFileName } from '../src/export';
import { createSchedule, normalizeLesson } from '../src/model';
import { buildPdf, deflate, isPdf, readPdfInfoValue } from '../src/pdf';
import { addTextChunk, isPng, readTextChunk } from '../src/png';
import { EXPORT, layoutBoard } from '../src/render';

// 1×1 transparent PNG.
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

function sample() {
  const s = createSchedule('Bc1JCF1');
  s.lessons.push(normalizeLesson({ day: 0, start: 8, duration: 2, subject: 'MECH', room: 'B-103', lecturer: 'Brenčík', color: 'pink' }));
  s.lessons.push(normalizeLesson({ day: 4, start: 14, duration: 2, subject: 'MAM1', color: 'grey' }));
  s.lessons.push(normalizeLesson({ day: 4, start: 14, duration: 2, subject: 'MAM2', color: 'grey' }));
  return s;
}

describe('embedded payload', () => {
  it('round-trips a schedule including Czech text, with fresh IDs', () => {
    const s = sample();
    const back = decodePayload(encodePayload(s))!;
    expect(back.specId).toBe('Bc1JCF1');
    expect(back.lessons.map((l) => l.lecturer)).toContain('Brenčík');
    expect(back.lessons.map(({ id: _id, ...rest }) => rest)).toEqual(s.lessons.map(({ id: _id, ...rest }) => rest));
    expect(back.id).not.toBe(s.id);
    expect(back.lessons[0]!.id).not.toBe(s.lessons[0]!.id);
  });

  it('rejects foreign or broken data', () => {
    expect(decodePayload('not base64!')).toBeNull();
    expect(decodePayload(btoa('{"app":"other"}'))).toBeNull();
  });
});

describe('PNG metadata', () => {
  it('embeds and reads back a tEXt chunk', () => {
    const out = addTextChunk(TINY_PNG, EMBED_KEY, 'abc+/=');
    expect(isPng(out)).toBe(true);
    expect(readTextChunk(out, EMBED_KEY)).toBe('abc+/=');
    expect(readTextChunk(out, 'Other')).toBeNull();
    expect(readTextChunk(TINY_PNG, EMBED_KEY)).toBeNull();
  });

  it('writes a valid chunk CRC', () => {
    const out = addTextChunk(TINY_PNG, 'k', 'v');
    // IHDR ends at 33; the new chunk follows: len(4) type(4) data(3) crc(4).
    const crc = new DataView(out.buffer).getUint32(33 + 8 + 3);
    expect(crc).toBe(crc32(out.subarray(33 + 4, 33 + 8 + 3)));
  });
});

describe('PDF writer', () => {
  it('produces a parseable PDF with the image, xref and embedded data', async () => {
    const rgb = new Uint8Array(4 * 2 * 3).fill(200);
    const deflated = await deflate(rgb);
    expect(new Uint8Array(inflateSync(deflated))).toEqual(rgb);

    const payload = encodePayload(sample());
    const pdf = buildPdf({ width: 4, height: 2, deflated }, { title: 'Rozvrh Bc1JČF', custom: { [EMBED_KEY]: payload } });
    expect(isPdf(pdf)).toBe(true);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toContain('/Subtype /Image /Width 4 /Height 2');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

    // Every xref offset must point at its "n 0 obj" header.
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    const entries = text.slice(startxref).split('\n').slice(3, 9);
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });

    expect(decodePayload(readPdfInfoValue(pdf, EMBED_KEY)!)?.lessons).toHaveLength(3);
  });
});

describe('export layout', () => {
  it('stacks parallel lessons and keeps every lesson inside the grid', () => {
    const layout = layoutBoard(sample());
    const friday = layout.lessons.filter((l) => l.lesson.day === 4);
    expect(friday.every((l) => l.compact)).toBe(true);
    expect(friday[0]!.rect.y).not.toBe(friday[1]!.rect.y);
    for (const { rect } of layout.lessons) {
      expect(rect.x).toBeGreaterThanOrEqual(layout.grid.x);
      expect(rect.x + rect.w).toBeLessThanOrEqual(layout.grid.x + layout.grid.w);
    }
    expect(layout.width).toBe(EXPORT.width);
    expect(layout.height).toBe(EXPORT.headerH + 5 * EXPORT.rowH + EXPORT.footerH);
  });

  it('builds safe file names', () => {
    expect(exportFileName(createSchedule('Bc1JI_JR2'), 'pdf')).toBe('rozvrh-Bc1JI_JR2.pdf');
    expect(exportFileName(createSchedule('../a b'), 'png')).toBe('rozvrh-a_b.png');
    expect(exportFileName(createSchedule(''), 'pdf')).toBe('rozvrh.pdf');
  });
});
