import { KNOWN_SPECS } from '../config';
import { EMBED_KEY, decodePayload } from '../embed';
import { normalizeSchedule, type Schedule } from '../model';
import { isPdf, readPdfInfoValue } from '../pdf';
import { isPng, readTextChunk } from '../png';
import { recognizeOfficial } from './recognize';

export type ImportStatus = (message: string) => void;

export class ImportError extends Error {}

/**
 * Reads data embedded by our own PDF/PNG export. Such files are restored
 * exactly, without OCR.
 */
export function readEmbeddedSchedule(bytes: Uint8Array): Schedule | null {
  const payload = isPng(bytes) ? readTextChunk(bytes, EMBED_KEY) : isPdf(bytes) ? readPdfInfoValue(bytes, EMBED_KEY) : null;
  return payload ? decodePayload(payload) : null;
}

/**
 * Picks the specialization ID: a known ID in the file name wins (official
 * files are named e.g. "Bc1JCF1.png"); otherwise the text read from the
 * image's corner (e.g. "JCF1") is matched against known IDs.
 */
export function guessSpecId(fileName: string, cornerText: string): string {
  const lower = fileName.toLowerCase();
  const fromName = [...KNOWN_SPECS].sort((a, b) => b.id.length - a.id.length).find((s) => lower.includes(s.id.toLowerCase()));
  if (fromName) return fromName.id;
  const corner = cornerText.trim();
  if (!corner) return '';
  const matches = KNOWN_SPECS.filter((s) => s.id.slice(3) === corner || s.id.slice(3) === `${corner}1`);
  return matches.length === 1 ? matches[0]!.id : corner;
}

export interface ImportResult {
  schedule: Schedule;
  /** True when texts were read by OCR (and may need checking). */
  usedOcr: boolean;
}

/** Imports a schedule from a PDF or image file (our export or an official one). */
export async function importSchedule(file: Blob, fileName: string, status: ImportStatus): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const embedded = readEmbeddedSchedule(bytes);
  if (embedded) return { schedule: embedded, usedOcr: false };

  const { imageToRaster, pdfToRaster } = await import('./raster-browser');
  status('Načítám soubor…');
  const raster = isPdf(bytes) ? await pdfToRaster(bytes) : await imageToRaster(file);

  status('Připravuji rozpoznávání textu (poprvé stahuje ~4 MB)…');
  const { createBrowserOcr } = await import('./ocr-browser');
  const ocr = await createBrowserOcr();
  try {
    const result = await recognizeOfficial(raster, ocr, (done, total) => status(`Rozpoznávám text… ${done}/${total}`));
    if (!result) {
      throw new ImportError(
        'V souboru se nepodařilo najít rozvrh. Podporované jsou exporty z této aplikace a rozvrhy z rozvrh.fjfi.cvut.cz (PDF, PNG nebo snímek obrazovky celé tabulky).',
      );
    }
    const schedule = normalizeSchedule({ specId: guessSpecId(fileName, result.specText), lessons: result.lessons });
    if (!schedule) throw new ImportError('Rozvrh se nepodařilo načíst.');
    return { schedule, usedOcr: true };
  } finally {
    await ocr.close();
  }
}
