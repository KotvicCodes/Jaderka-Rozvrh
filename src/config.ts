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

export interface KnownSpec {
  id: string;
  name: string;
}

/** Specialization / study-group IDs published for bachelor years 1–3. */
export const KNOWN_SPECS: readonly KnownSpec[] = [
  { id: 'Bc1AAA1', name: 'Aplikovaná algebra a analýza 1. kruh' },
  { id: 'Bc1AAA2', name: 'Aplikovaná algebra a analýza 2. kruh' },
  { id: 'Bc1AIPV1', name: 'Aplikace informatiky v přírodních vědách 1. kruh' },
  { id: 'Bc1AIPV2', name: 'Aplikace informatiky v přírodních vědách 2. kruh' },
  { id: 'Bc1AMSM1', name: 'Aplikované matematicko-stochastické metody' },
  { id: 'Bc1APIN1', name: 'Aplikovaná informatika' },
  { id: 'Bc1FI_FIM1', name: 'Fyzikální inženýrství, spec. Fyzikální inženýrství materiálů' },
  { id: 'Bc1FI_FPTF1', name: 'Fyzikální inženýrství, spec. Fyzika plazmatu a termojaderné fúze 1. kruh' },
  { id: 'Bc1FI_FPTF2', name: 'Fyzikální inženýrství, spec. Fyzika plazmatu a termojaderné fúze 2. kruh' },
  { id: 'Bc1FI_IPL1', name: 'Fyzikální inženýrství, spec. Inženýrství pevných látek' },
  { id: 'Bc1FI_LTF1', name: 'Fyzikální inženýrství, spec. Laserová technika a fotonika' },
  { id: 'Bc1FI_PF1', name: 'Fyzikální inženýrství, spec. Počítačová fyzika' },
  { id: 'Bc1JCF1', name: 'Jaderná a částicová fyzika 1. kruh' },
  { id: 'Bc1JCF2', name: 'Jaderná a částicová fyzika 2. kruh' },
  { id: 'Bc1JCF3', name: 'Jaderná a částicová fyzika 3. kruh' },
  { id: 'Bc1JCH1', name: 'Jaderná chemie' },
  { id: 'Bc1JI_AFIZ1', name: 'Jaderné inženýrství, spec. Aplikovaná fyzika ionizujícího záření' },
  { id: 'Bc1JI_JR1', name: 'Jaderné inženýrství, spec. Jaderné reaktory 1. kruh' },
  { id: 'Bc1JI_JR2', name: 'Jaderné inženýrství, spec. Jaderné reaktory 2. kruh' },
  { id: 'Bc1JI_JR3', name: 'Jaderné inženýrství, spec. Jaderné reaktory 3. kruh' },
  { id: 'Bc1JI_JR4', name: 'Jaderné inženýrství, spec. Jaderné reaktory 4. kruh' },
  { id: 'Bc1JI_RZP1', name: 'Jaderné inženýrství, spec. Radioaktivita v životním prostředí' },
  { id: 'Bc1KT1', name: 'Kvantové technologie' },
  { id: 'Bc1MI_MF1', name: 'Matematické inženýrství, spec. Matematická fyzika' },
  { id: 'Bc1MI_MINF1', name: 'Matematické inženýrství, spec. Matematická informatika' },
  { id: 'Bc1MI_MM1', name: 'Matematické inženýrství, spec. Matematické modelování' },
  { id: 'Bc1RT1', name: 'Radiologická technika' },
  { id: 'Bc1VJZP1', name: 'Vyřazování jaderných zařízení z provozu' },
  { id: 'Bc2AAA1', name: 'Aplikovaná algebra a analýza' },
  { id: 'Bc2AIPV1', name: 'Aplikace informatiky v přírodních vědách' },
  { id: 'Bc2AMSM1', name: 'Aplikované matematicko-stochastické metody' },
  { id: 'Bc2APIN1', name: 'Aplikovaná informatika' },
  { id: 'Bc2FI_FIM1', name: 'Fyzikální inženýrství, spec. Fyzikální inženýrství materiálů' },
  { id: 'Bc2FI_FPTF1', name: 'Fyzikální inženýrství, spec. Fyzika plazmatu a termojaderné fúze' },
  { id: 'Bc2FI_IPL1', name: 'Fyzikální inženýrství, spec. Inženýrství pevných látek' },
  { id: 'Bc2FI_LTF1', name: 'Fyzikální inženýrství, spec. Laserová technika a fotonika' },
  { id: 'Bc2FI_PF1', name: 'Fyzikální inženýrství, spec. Počítačová fyzika' },
  { id: 'Bc2JCF1', name: 'Jaderná a částicová fyzika 1. kruh' },
  { id: 'Bc2JCF2', name: 'Jaderná a částicová fyzika 2. kruh' },
  { id: 'Bc2JCH1', name: 'Jaderná chemie' },
  { id: 'Bc2JI_AFIZ1', name: 'Jaderné inženýrství, spec. Aplikovaná fyzika ionizujícího záření' },
  { id: 'Bc2JI_JR1', name: 'Jaderné inženýrství, spec. Jaderné reaktory 1. kruh' },
  { id: 'Bc2JI_JR2', name: 'Jaderné inženýrství, spec. Jaderné reaktory 2. kruh' },
  { id: 'Bc2JI_RZP1', name: 'Jaderné inženýrství, spec. Radioaktivita v životním prostředí' },
  { id: 'Bc2KT1', name: 'Kvantové technologie' },
  { id: 'Bc2MI_MF1', name: 'Matematické inženýrství, spec. Matematická fyzika' },
  { id: 'Bc2MI_MINF1', name: 'Matematické inženýrství, spec. Matematická informatika' },
  { id: 'Bc2MI_MM1', name: 'Matematické inženýrství, spec. Matematické modelování' },
  { id: 'Bc2RT1', name: 'Radiologická technika' },
  { id: 'Bc2VJZP1', name: 'Vyřazování jaderných zařízení z provozu' },
  { id: 'Bc3AAA1', name: 'Aplikovaná algebra a analýza 1. kruh' },
  { id: 'Bc3AIPV1', name: 'Aplikace informatiky v přírodních vědách 1. kruh' },
  { id: 'Bc3AMSM1', name: 'Aplikované matematicko-stochastické metody 1. kruh' },
  { id: 'Bc3APIN1', name: 'Aplikovaná informatika 1. kruh' },
  { id: 'Bc3FI_FIM1', name: 'Fyzikální inženýrství, spec. Fyzikální inženýrství materiálů 1. kruh' },
  { id: 'Bc3FI_FPTF1', name: 'Fyzikální inženýrství, spec. Fyzika plazmatu a termojaderné fúze 1. kruh' },
  { id: 'Bc3FI_IPL1', name: 'Fyzikální inženýrství, spec. Inženýrství pevných látek 1. kruh' },
  { id: 'Bc3FI_LTF1', name: 'Fyzikální inženýrství, spec. Laserová technika a fotonika 1. kruh' },
  { id: 'Bc3FI_PF1', name: 'Fyzikální inženýrství, spec. Počítačová fyzika 1. kruh' },
  { id: 'Bc3JCF1', name: 'Jaderná a částicová fyzika 1. kruh' },
  { id: 'Bc3JCH1', name: 'Jaderná chemie 1. kruh' },
  { id: 'Bc3JI_AFIZ1', name: 'Jaderné inženýrství, spec. Aplikovaná fyzika ionizujícího záření 1. kruh' },
  { id: 'Bc3JI_JR1', name: 'Jaderné inženýrství, spec. Jaderné reaktory 1. kruh' },
  { id: 'Bc3JI_RZP1', name: 'Jaderné inženýrství, spec. Radioaktivita v životním prostředí 1. kruh' },
  { id: 'Bc3KT1', name: 'Kvantové technologie 1. kruh' },
  { id: 'Bc3MI_MF1', name: 'Matematické inženýrství, spec. Matematická fyzika 1. kruh' },
  { id: 'Bc3MI_MINF1', name: 'Matematické inženýrství, spec. Matematická informatika 1. kruh' },
  { id: 'Bc3MI_MM1', name: 'Matematické inženýrství, spec. Matematické modelování 1. kruh' },
  { id: 'Bc3RT1', name: 'Radiologická technika 1. kruh' },
  { id: 'Bc3VJZP1', name: 'Vyřazování jaderných zařízení z provozu 1. kruh' },
];
