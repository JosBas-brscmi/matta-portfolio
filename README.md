# Browave MATTA Learning Portfolio

The MATTA Learning Portfolio System is the long-term training record for every
Management Associate Trainee (MT) at Browave's Philippines operations. It
captures onboarding, general training, departmental training, portfolio
submissions, assessments, mentor feedback, and final placement decisions.

## Tech stack

- **Frontend**: React 18 + Vite + TypeScript
- **Hosting**: Netlify (auto-deploy from GitHub `main` branch)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)

## Roles

- **MT** — Management Associate Trainee
- **MA Center** — Program administrators
- **Mentor** — Department trainer assigned to each MT
- **Manager** — Department manager
- **MA Board** — Senior management for graduation / placement decisions

## Local development (PHP + Laragon)

This repository can run locally using Laragon / Apache with a local PostgreSQL.

To run locally with the PHP API:

1. Ensure your local PostgreSQL is running and the database is accessible.
2. Confirm DB credentials in `api/config.php` or set these environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
3. Start your frontend (Vite) for fast dev or serve the built files from Apache. For Vite dev:

```bash
npm install
npm run dev
```

Notes:
- The app now talks to a local PHP API under `/api/` for auth, REST, and uploads.
- File uploads are stored in `storage/uploads/` and served from `/storage/uploads/` when using Apache.

## Environment variables

Set these in Netlify → Site settings → Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## License

Internal use only — Browave Corporation.
