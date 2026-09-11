# The Ledge

Booking and content-managed site: React + Vite front end, Express + Drizzle/Postgres back end,
served as a single Node process in production.

The site ships populated with **demo content** for a modern hotel — rooms, rates, services,
FAQs, and photography — so it looks finished out of the box. All of it is meant to be
replaced with the real thing (see "What to replace" below).

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

## What to replace

The demo content is plausible but invented. Before this goes anywhere public:

- **Contact details** — the phone number, address (Ridgeview Drive, Antipolo) and
  coordinates in `src/lib/cmsState.ts` and the footer in `src/App.tsx` are made up.
- **Payment accounts** — the GCash / Maya / bank numbers in `DEFAULT_PAYMENT_INSTRUCTIONS`
  (`server.ts`) are `0000` placeholders. Real bookings will not get paid until these are set.
- **The guest testimonial** in `DEFAULT_ABOUT` is invented. Do not ship a fake review.
- **Photography** — every image is a hosted Unsplash URL, listed in
  `HIGH_QUALITY_PRESET_IMAGES` (`src/lib/cmsState.ts`). Fine for a demo; swap in your own
  photos for production rather than hotlinking a third party.
- **Rates and inventory** — ₱8,500 / ₱5,200 / ₱3,400 and the 6 / 12 / 18 room counts are
  set in three places that must agree: `src/lib/cmsState.ts`, `src/data.ts`, and
  `src/db/seed-catalog.ts` (plus the startup fallback in `server.ts`).

## Design notes

- **Palette** — the brand surface is a light grey. Every colour funnels through `--vp-*`
  variables at the top of `src/index.css`, so re-skinning the whole site means editing that
  one block. Light is the default theme; dark is a neutral charcoal, not a tinted one.
  The Tailwind token names (`pine-*`, `gold-*`, `cream-*`) are historical — they are just
  names for "surface", "accent", and "type", so change the values, not the classNames.
- **Currency** — amounts are formatted as PHP / `₱` (`peso()` in `server.ts`, and `₱` literals
  in the components). Change these if you bill in another currency.
- **Unit tiers** — the three slugs above are load-bearing: they are referenced by the booking
  form defaults (`src/App.tsx`, `src/components/BookingSystem.tsx`), the DB seed
  (`src/db/seed-catalog.ts`), and the server fallback seed. Rename them in all four places or
  not at all.
- **Reference prefix** — reservation codes are `TL-XXXXXX`, set in `server.ts`.
- **Storage keys** — browser keys are prefixed `tl_` / `ledge_`. Site content lives in
  `localStorage` under `ledge_cms_data`; a first visit seeds it from the defaults, and
  "Reset to blank" in the Admin Panel clears it.

## Deployment

`Dockerfile` builds a two-stage production image and runs as an unprivileged user.
The server reads `PORT` (default 3000) and exposes a health check at `/healthz`.
Set the same variables from `.env.example` in your host's environment panel.
