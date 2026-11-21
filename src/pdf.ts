/**
 * Dependency-free single-page PDF writer: one lossless (Flate) RGB image on
 * an A4 landscape page, with optional custom entries in the Info dictionary.
 */

export interface PdfImage {
  /** Width/height in pixels. */
  width: number;
  height: number;
  /** zlib-compressed RGB bytes (FlateDecode). */
  deflated: Uint8Array;
}

const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const MARGIN = 24;

/** PDF text string that keeps non-ASCII characters (UTF-16BE hex). */
function pdfTextString(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex.toUpperCase()}>`;
}

/** Encodes ASCII-only values (e.g. base64) as a literal string. */
function pdfAsciiString(text: string): string {
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error('Custom PDF values must be printable ASCII');
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

export function buildPdf(image: PdfImage, info: { title: string; custom?: Record<string, string> }): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };

  const scale = Math.min((A4_LANDSCAPE.w - 2 * MARGIN) / image.width, (A4_LANDSCAPE.h - 2 * MARGIN) / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const x = (A4_LANDSCAPE.w - drawW) / 2;
  const y = (A4_LANDSCAPE.h - drawH) / 2;
  const content = enc.encode(`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`);

  const custom = Object.entries(info.custom ?? {})
    .map(([key, value]) => {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error(`Invalid PDF key: ${key}`);
      return ` /${key} ${pdfAsciiString(value)}`;
    })
    .join('');

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE.w} ${A4_LANDSCAPE.h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.deflated.length} >>`,
    image.deflated,
  );
  object(5, `<< /Length ${content.length} >>`, content);
  object(6, `<< /Title ${pdfTextString(info.title)} /Producer ${pdfTextString('Jaderňácký Rozvrh')}${custom} >>`);

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let n = 1; n <= 6; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Reads a custom ASCII Info entry written by `buildPdf`. */
export function readPdfInfoValue(pdf: Uint8Array, key: string): string | null {
  // Latin-1 decoding keeps byte offsets and never throws on binary streams.
  let text = '';
  for (let i = 0; i < pdf.length; i += 0x8000) text += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
  const match = new RegExp(`/${key} \\(([A-Za-z0-9+/=]*)\\)`).exec(text);
  return match ? match[1]! : null;
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** zlib-deflates bytes with the browser's CompressionStream. */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
