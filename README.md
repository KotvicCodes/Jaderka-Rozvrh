# Jaderka Rozvrh

A lightweight web app for FJFI ČVUT ("Jaderka") students to build and edit their
own timetable, styled after the official schedules at
[rozvrh.fjfi.cvut.cz](https://rozvrh.fjfi.cvut.cz/rozvrh/studenti/bs1), and
download it as a PDF.

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
