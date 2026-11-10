# WeightSnap

A small web app for logging your body weight, setting a goal weight, and watching your progress on a chart.

## Features

- **Sign in with GitHub or Google.** Accounts are matched by verified email, so you can use either provider for the same account.
- **Log weigh-ins** with a date and an optional note, in pounds or kilograms.
- **Progress chart** of your entries over time, with your goal shown as a reference line.
- **Goal weight** that you can set, change, or remove.
- **Display unit toggle** between lbs and kg. Your choice is saved to your account, and entries logged in the other unit are converted for display.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) with React 19 and TypeScript
- [Auth.js / NextAuth v5](https://authjs.dev) with database sessions
- [Drizzle ORM](https://orm.drizzle.team) on [Neon](https://neon.tech) serverless Postgres
- [Recharts](https://recharts.org) for the chart and [Tailwind CSS v4](https://tailwindcss.com) for styling
- [Zod](https://zod.dev) for validating form input

## Getting started

### Prerequisites

- Node.js 20 or later
- A Postgres database. The app connects with the Neon serverless driver, so a [Neon](https://neon.tech) database is the easiest option.
- OAuth apps for GitHub and/or Google

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Secret for signing sessions. Generate one with `npx auth secret`. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |

Set the OAuth callback URLs to:

- GitHub: `http://localhost:3000/api/auth/callback/github`
- Google: `http://localhost:3000/api/auth/callback/google`

### 3. Run database migrations

```bash
npm run db:migrate
```

Next.js reads `.env.local`, but `drizzle-kit` only reads `.env`. If `DATABASE_URL` is only in `.env.local`, load it when you run the command:

```bash
node --env-file=.env.local node_modules/.bin/drizzle-kit migrate
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate a new migration from changes to `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

## Project structure

```
src/
  app/
    page.tsx                      Sign-in page
    dashboard/page.tsx            Main dashboard (chart, entries, form, goal)
    dashboard/actions.ts          Server Actions for entries, goals, and units
    api/auth/[...nextauth]/       Auth.js route handler
  auth.ts                         Auth.js config (providers, Drizzle adapter)
  proxy.ts                        Protects /dashboard routes
  components/                     UI components (chart, form, entry list, etc.)
  db/schema.ts                    Drizzle schema
  db/index.ts                     Database client
  lib/units.ts                    lbs/kg conversion helpers
drizzle/                          Generated SQL migrations
```

## Deployment

The app deploys to [Vercel](https://vercel.com). Set the same environment variables in your Vercel project, and add the production callback URLs (`https://<your-domain>/api/auth/callback/github` and `.../google`) to your OAuth apps. Run `npm run db:migrate` against the production database before deploying a schema change.
