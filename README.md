# The Ledge

Booking and content-managed site: React + Vite front end, Express + Drizzle/Postgres back end,
served as a single Node process in production.

This repo started from a reusable template. All placeholder copy is marked in `[BRACKETS]` —
search for `[` to find everything that still needs your words.

## Requirements

- Node.js 20 or newer
- A Postgres database (Supabase, Neon, RDS, or local)

## Setup

```bash
npm install
cp .env.example .env     # then fill in the values
npm run db:push          # create the schema
npm run dev              # http://localhost:3000
```

`.env` is gitignored and must never be committed. Every credential is read from the
environment — there are no secrets in source.

### First run

On first boot against an empty database the server:

1. Seeds three unit types (`unit-premium`, `unit-standard`, `unit-basic`) with one unit each
   and a rate of 0.
2. Creates the admin account from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`. If you leave the
   password blank, a random one is generated and printed to the console **once** — copy it.
   Remove both variables after the first boot.

Then open the Admin Panel from the toggle bar to set real rates, unit counts, copy, and
payment details.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Build client (`dist/`) and bundle server (`dist/server.cjs`) |
| `npm start` | Run the production bundle |
| `npm run lint` | Typecheck with `tsc --noEmit` |
| `npm run db:push` | Push the Drizzle schema to the database |

## What to customize

Beyond the `[BRACKETED]` copy, these are deliberate template defaults you may want to change:

- **Currency** — amounts are formatted as PHP / `₱` (`peso()` in `server.ts`, and `₱` literals
  in the components). Change these if you bill in another currency.
- **Unit tiers** — the three slugs above are load-bearing: they are referenced by the booking
  form defaults (`src/App.tsx`, `src/components/BookingSystem.tsx`), the DB seed
  (`src/db/seed-catalog.ts`), and the server fallback seed. Rename them in all four places or
  not at all.
- **Reference prefix** — reservation codes are `TL-XXXXXX`, set in `server.ts`.
- **Palette** — Tailwind tokens are named `pine-*`, `cream-*`, `gold-*`, `ink-*` in
  `src/index.css`. Names are cosmetic; change the values to rebrand.
- **Storage keys** — browser keys are prefixed `tl_` / `ledge_`.

## Deployment

`Dockerfile` builds a two-stage production image and runs as an unprivileged user.
The server reads `PORT` (default 3000) and exposes a health check at `/healthz`.
Set the same variables from `.env.example` in your host's environment panel.
