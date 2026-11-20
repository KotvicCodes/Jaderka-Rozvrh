# Jaderka Rozvrh

A lightweight web app for FJFI ČVUT ("Jaderka") students to build and edit their
own timetable, styled after the official schedules at
[rozvrh.fjfi.cvut.cz](https://rozvrh.fjfi.cvut.cz/rozvrh/studenti/bs1), and
download it as a PDF.

## Features

- Timetable grid laid out like the official one: Monday–Friday rows, 8:00–20:00 columns.
- Click any free hour slot to add a lesson; click a lesson to edit or delete it.
- Each lesson has a subject, classroom, lecturer, duration and colour.
- Lessons always start on a whole hour (10:00, 11:00, …) and end by 20:00.
- The colour palette uses every lesson colour found on the bs1–bs3 schedules.
- Each schedule has a specialization ID (e.g. `Bc1JCF1`), with suggestions for all published IDs.
- Overlapping (parallel) lessons are stacked, as on the official timetable.
- Drag and drop lessons to another day or hour (snaps to whole hours); Alt + arrow keys do the same from the keyboard.
- Download as **PDF** (A4 landscape) or **PNG**, drawn like the official timetable, with a watermark and site credit.
  The watermark text lives in `WATERMARK` in `src/config.ts`.
- Exports carry the schedule data invisibly (PNG `tEXt` chunk, PDF Info entry), so they can be imported back later.
- Several schedules can be kept side by side; everything is saved in the browser (`localStorage`).

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
