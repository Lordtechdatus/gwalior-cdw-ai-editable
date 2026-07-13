# Nirmal Gwalior C&D Waste Intelligence

A role-based Next.js platform for construction and demolition waste reporting, image-assisted analysis, collection tracking, recycler verification, and authority compliance review.

## Roles

- Waste Generator: upload site images, analyse material, submit reports, and track collection.
- Recycler: review assigned loads and record recovery.
- Authority: review reports, compliance, and city operations.

## Vercel architecture

- Next.js App Router for the interface and all API route handlers.
- PostgreSQL through Drizzle ORM. Vercel Postgres, Neon, and Supabase PostgreSQL connection strings are supported.
- Vercel Blob for production image uploads.
- Local filesystem storage under `public/uploads` during development when Blob is not configured.
- Optional external Python inference service, with a deterministic prototype analyser as the fallback.

The project does not require Vinext, Vite, Wrangler, Cloudflare Workers, D1, R2, Bash, `flock`, or GNU `timeout`.

## Environment variables

Copy `.env.example` to `.env.local` and configure:

```dotenv
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/gwalior_cdw
BLOB_READ_WRITE_TOKEN=
VITE_AI_API_URL=
AI_ANALYSIS_MODE=prototype
AI_SERVICE_TOKEN=
DEMO_OTP_MODE=true
NEXT_PUBLIC_DEMO_OTP_MODE=true
OTP=123456
AUTH_OTP_HASH_SECRET=replace-with-a-long-random-secret
```

`POSTGRES_URL` (or `DATABASE_URL`) is required for report persistence. `BLOB_READ_WRITE_TOKEN` is required for uploads on Vercel but optional locally. Add the same values in the Vercel project settings before deployment.

`VITE_AI_API_URL` configures the optional inference API (for example, `https://ai.example.com`). During local development only, it defaults to `http://localhost:8000`. Set `AI_ANALYSIS_MODE=prototype` for deterministic demo results without an external AI provider. For external inference, set `AI_ANALYSIS_MODE=production` and configure `VITE_AI_API_URL` in production.

## Database

The PostgreSQL schema is in `db/schema.ts`; generated SQL migrations are in `drizzle/`.

```text
npm run db:generate
```

Apply the generated migration through your PostgreSQL provider before using `/api/reports`.

## Local verification

```text
npm install
npm run build
npm run start
```

The production server starts at <http://localhost:3000>. For development with hot reload, use `npm run dev`.

## API routes

- `POST /api/analyze`
- `GET|POST /api/reports`
- `POST /api/uploads`
- `POST /api/auth/send-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/verify-otp`
- `GET /api/auth/session`
- `POST /api/auth/logout`

Demo OTP mode accepts `OTP` (default `123456`) only when `DEMO_OTP_MODE=true`. The value is never returned by the authentication API.

## Model limitation

The repository does not include trained model weights or calibrated field measurements. The fallback analyser is a deterministic software prototype and must not be treated as a scientifically validated quantity estimate.
