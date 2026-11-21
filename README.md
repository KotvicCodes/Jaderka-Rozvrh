# Jaderňácký Rozvrh

A lightweight web app for FJFI ČVUT ("Jaderka") students to build and edit their
own timetable, styled after the official schedules at
[rozvrh.fjfi.cvut.cz](https://rozvrh.fjfi.cvut.cz/rozvrh/studenti/bs1), and
download it as a PDF.

## Features

- Timetable grid laid out like the official one: Monday–Friday rows, 8:00–20:00 columns.
- Click any free hour slot to add a lesson; click a lesson to edit or delete it.
- Each lesson has a subject, classroom, lecturer, duration and colour.
- Lessons always start on a whole hour (10:00, 11:00, …) and end by 20:00.
- Colours follow the official scheme: one colour per department (katedra), labelled with its abbreviation (KM, KF, KHVJ, KIPL, KLFF, KMAT, KJCH, KDAIZ, KJR, KSI).
- Each schedule belongs to a study program (obor), picked from the published bachelor programs, and a kruh (–, 1, 2 or 3; the same choice for every program, since kruh counts change between years). The timetable shows them like the official one, without the year: `JCF1`, or just `FI_IPL` when the kruh is –.
- Click the ID in the timetable's top-left corner to type any ID by hand.
- Overlapping (parallel) lessons are stacked, as on the official timetable.
- Drag and drop lessons to another day or hour (snaps to whole hours); Alt + arrow keys do the same from the keyboard.
- Download as **PDF** (A4 landscape) or **PNG**, drawn like the official timetable.
- Exports carry the schedule data invisibly (PNG `tEXt` chunk, PDF Info entry), so they can be imported back later.
- **Import** a timetable from a file, by pasting (Ctrl+V) or by dropping it on the page:
  - our own PDF/PNG exports are restored exactly from the data embedded in them;
  - official PDFs/PNGs from rozvrh.fjfi.cvut.cz (or a screenshot of the whole table) are recognised:
    block positions, lengths, parallel lanes and colours come from the image, and subject, lecturer and room
    are read with OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)). PDFs give the best results because
    they are rendered at high resolution; titles read from the small PNGs are worth double-checking.
  - lecturers and rooms read by OCR are matched against the official lists of teachers and classrooms
    (`src/import/known-names.ts`): a name 1–2 letters off a single known teacher becomes that teacher, with
    proper diacritics. Refresh the lists each semester with `npm run update-names`.
  - pdf.js and the OCR engine (~4 MB, from a CDN) load only when an import needs them.
- Several schedules (e.g. one per semester) are kept side by side as tabs: click a tab to switch, double-click it (or press F2) to rename it, `+` adds a new one. Everything is saved in the browser (`localStorage`).

Built with plain TypeScript and [Vite](https://vite.dev); no UI framework.

## Development

```sh
npm install
npm run dev        # local dev server
npm run typecheck  # TypeScript checks
npm test           # unit tests (Vitest)
npm run build      # production build into dist/
```

Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`.

## Licence

MIT
