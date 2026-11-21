/** Static configuration mirroring the official FJFI timetables (rozvrh.fjfi.cvut.cz). */

export const DAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'] as const;

/** First hour shown in the grid (lessons may start here). */
export const FIRST_HOUR = 8;
/** Hour at which the grid ends (no lesson may run past it). */
export const LAST_HOUR = 20;
export const HOUR_COUNT = LAST_HOUR - FIRST_HOUR;

export interface PaletteColor {
  /** Stable key stored with lessons. */
  id: string;
  /** Department abbreviation, e.g. "KM". */
  dept: string;
  /** Department name, e.g. "katedra matematiky". */
  deptName: string;
  /** Subject-code prefix of the department's courses, e.g. "01" for 01MAN. */
  code: string;
  /** Block background. */
  fill: string;
  /** Block outline. */
  border: string;
}

/**
 * Lesson colours of the official timetables. Each department (katedra) has
 * one colour, used for all of its courses (rozvrh.fjfi.cvut.cz → Informace →
 * FAQ, "Proč je lísteček barevný?"). Which colour belongs to which
 * department was read off the departments' teacher timetables
 * (/rozvrh/ucitele/<katedra>); fill and outline values are sampled from the
 * published PNGs. Ordered by subject-code prefix.
 */
export const PALETTE: readonly PaletteColor[] = [
  { id: 'green', dept: 'KM', deptName: 'katedra matematiky', code: '01', fill: '#a1e264', border: '#87d938' },
  { id: 'pink', dept: 'KF', deptName: 'katedra fyziky', code: '02', fill: '#faa8a8', border: '#f88f8f' },
  { id: 'grey', dept: 'KHVJ', deptName: 'katedra humanitních věd a jazyků', code: '04', fill: '#c7c7c7', border: '#b6b6b6' },
  { id: 'red', dept: 'KIPL', deptName: 'katedra inženýrství pevných látek', code: '11', fill: '#de5555', border: '#d42525' },
  { id: 'orange', dept: 'KLFF', deptName: 'katedra laserové fyziky a fotoniky', code: '12', fill: '#f8a555', border: '#f68c25' },
  { id: 'teal', dept: 'KMAT', deptName: 'katedra materiálů', code: '14', fill: '#55ded2', border: '#25d4c5' },
  { id: 'purple', dept: 'KJCH', deptName: 'katedra jaderné chemie', code: '15', fill: '#a38ba7', border: '#89698e' },
  { id: 'blue', dept: 'KDAIZ', deptName: 'katedra dozimetrie a aplikace ionizujícího záření', code: '16', fill: '#7898c3', border: '#517bb1' },
  { id: 'yellow', dept: 'KJR', deptName: 'katedra jaderných reaktorů', code: '17', fill: '#f3e255', border: '#f0da25' },
  { id: 'tan', dept: 'KSI', deptName: 'katedra softwarového inženýrství', code: '18', fill: '#d6a860', border: '#ca8f33' },
];

/** Human-readable label of a palette colour, e.g. "KM – katedra matematiky (01…)". */
export function paletteLabel(c: PaletteColor): string {
  return `${c.dept} – ${c.deptName} (${c.code}…)`;
}

export const DEFAULT_COLOR_ID = 'green';

export function paletteColor(id: string): PaletteColor {
  return PALETTE.find((c) => c.id === id) ?? PALETTE[0]!;
}

export interface StudyProgram {
  /** Code used in the official IDs, e.g. "JCF" (from "Bc1JCF2"). */
  code: string;
  /** Study program (obor / specializace) name, without year or kruh. */
  name: string;
  /** Number of study groups (kruhy); the most any bachelor year has. */
  groups: number;
}

/**
 * Bachelor study programs published at rozvrh.fjfi.cvut.cz (years 1–3,
 * official IDs like "Bc1JCF2" = year 1, JCF, kruh 2), sorted by name.
 */
export const PROGRAMS: readonly StudyProgram[] = [
  { code: 'AIPV', name: 'Aplikace informatiky v přírodních vědách', groups: 2 },
  { code: 'AAA', name: 'Aplikovaná algebra a analýza', groups: 2 },
  { code: 'APIN', name: 'Aplikovaná informatika', groups: 1 },
  { code: 'AMSM', name: 'Aplikované matematicko-stochastické metody', groups: 1 },
  { code: 'FI_FPTF', name: 'Fyzikální inženýrství, spec. Fyzika plazmatu a termojaderné fúze', groups: 2 },
  { code: 'FI_FIM', name: 'Fyzikální inženýrství, spec. Fyzikální inženýrství materiálů', groups: 1 },
  { code: 'FI_IPL', name: 'Fyzikální inženýrství, spec. Inženýrství pevných látek', groups: 1 },
  { code: 'FI_LTF', name: 'Fyzikální inženýrství, spec. Laserová technika a fotonika', groups: 1 },
  { code: 'FI_PF', name: 'Fyzikální inženýrství, spec. Počítačová fyzika', groups: 1 },
  { code: 'JCF', name: 'Jaderná a částicová fyzika', groups: 3 },
  { code: 'JCH', name: 'Jaderná chemie', groups: 1 },
  { code: 'JI_AFIZ', name: 'Jaderné inženýrství, spec. Aplikovaná fyzika ionizujícího záření', groups: 1 },
  { code: 'JI_JR', name: 'Jaderné inženýrství, spec. Jaderné reaktory', groups: 4 },
  { code: 'JI_RZP', name: 'Jaderné inženýrství, spec. Radioaktivita v životním prostředí', groups: 1 },
  { code: 'KT', name: 'Kvantové technologie', groups: 1 },
  { code: 'MI_MF', name: 'Matematické inženýrství, spec. Matematická fyzika', groups: 1 },
  { code: 'MI_MINF', name: 'Matematické inženýrství, spec. Matematická informatika', groups: 1 },
  { code: 'MI_MM', name: 'Matematické inženýrství, spec. Matematické modelování', groups: 1 },
  { code: 'RT', name: 'Radiologická technika', groups: 1 },
  { code: 'VJZP', name: 'Vyřazování jaderných zařízení z provozu', groups: 1 },
];

export interface ParsedSpec {
  program: StudyProgram;
  /** Kruh, 1-based. */
  group: number;
}

/**
 * Reads a program and kruh from an ID such as "JCF2", "FI_IPL" or the
 * official file-name form "Bc1JCF2" (the year prefix is ignored).
 */
export function parseSpecId(raw: string): ParsedSpec | null {
  const m = /^(?:bc[1-9])?([a-z_]+?)(\d*)$/i.exec(raw.trim());
  if (!m) return null;
  const program = PROGRAMS.find((p) => p.code.toLowerCase() === m[1]!.toLowerCase());
  if (!program) return null;
  const group = m[2] ? Number(m[2]) : 1;
  return group >= 1 && group <= program.groups ? { program, group } : null;
}

/**
 * The ID shown on the timetable, as on the official one: the program code,
 * followed by the kruh only when the program has more than one ("JCF1",
 * but "FI_IPL"). No year.
 */
export function formatSpecId(program: StudyProgram, group: number): string {
  return program.groups > 1 ? `${program.code}${group}` : program.code;
}

/** Rewrites a known ID to its timetable form; anything else is kept as typed. */
export function canonicalSpecId(raw: string): string {
  const parsed = parseSpecId(raw);
  return parsed ? formatSpecId(parsed.program, parsed.group) : raw.trim();
}
