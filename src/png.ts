/** Minimal PNG chunk helpers for embedding/reading tEXt metadata. */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) throw new Error('tEXt chunks only hold Latin-1 text');
    out[i] = code;
  }
  return out;
}

/** Returns a copy of `png` with a tEXt chunk inserted right after IHDR. */
export function addTextChunk(png: Uint8Array, keyword: string, text: string): Uint8Array {
  if (!isPng(png)) throw new Error('Not a PNG file');
  const data = latin1(`${keyword}\0${text}`);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(latin1('tEXt'), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

  const ihdrEnd = 8 + 12 + new DataView(png.buffer, png.byteOffset).getUint32(8);
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

/** Reads the text of the first tEXt chunk with the given keyword. */
export function readTextChunk(png: Uint8Array, keyword: string): string | null {
  if (!isPng(png)) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 12 <= png.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (pos + 12 + len > png.length) return null;
    if (type === 'tEXt') {
      const body = png.subarray(pos + 8, pos + 8 + len);
      const sep = body.indexOf(0);
      if (sep > 0 && String.fromCharCode(...body.subarray(0, sep)) === keyword) {
        let text = '';
        for (const b of body.subarray(sep + 1)) text += String.fromCharCode(b);
        return text;
      }
    }
    if (type === 'IEND') return null;
    pos += 12 + len;
  }
  return null;
}
