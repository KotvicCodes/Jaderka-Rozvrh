import { normalizeSchedule, type Schedule } from './model';

/** Key used for the schedule data hidden inside exported PNG/PDF files. */
export const EMBED_KEY = 'JaderkaRozvrh';

interface Payload {
  app: 'jaderka-rozvrh';
  v: 1;
  schedule: Pick<Schedule, 'specId' | 'lessons'>;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Serialises a schedule as ASCII-safe base64 (UTF-8 JSON inside). */
export function encodePayload(schedule: Schedule): string {
  const payload: Payload = {
    app: 'jaderka-rozvrh',
    v: 1,
    schedule: { specId: schedule.specId, lessons: schedule.lessons },
  };
  return toBase64(new TextEncoder().encode(JSON.stringify(payload)));
}

/** Parses an embedded payload back into a fresh, validated schedule. */
export function decodePayload(text: string): Schedule | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64(text.trim()))) as Partial<Payload>;
    if (data?.app !== 'jaderka-rozvrh' || !data.schedule) return null;
    const schedule = normalizeSchedule({ specId: data.schedule.specId, lessons: data.schedule.lessons });
    // Imported copies get fresh IDs so they never clash with existing schedules.
    return schedule && normalizeSchedule({ ...schedule, id: undefined, lessons: schedule.lessons.map((l) => ({ ...l, id: undefined })) });
  } catch {
    return null;
  }
}
