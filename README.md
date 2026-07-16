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
- Vercel Blob storage for production-mode uploads; prototype mode deliberately skips image storage.
- Optional external Python inference service, with a deterministic prototype analyser as the fallback.

The project does not require Vinext, Vite, Wrangler, Cloudflare Workers, D1, R2, Bash, `flock`, or GNU `timeout`.

## Environment variables

Copy `.env.example` to `.env.local` and configure:

```dotenv
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/gwalior_cdw
BLOB_READ_WRITE_TOKEN=
CDW_INFERENCE_MODE=prototype
AI_API_URL=
AI_SERVICE_URL=
NEXT_PUBLIC_AI_API_URL=
AI_SERVICE_TOKEN=
DEMO_OTP_MODE=true
NEXT_PUBLIC_DEMO_OTP_MODE=true
OTP=123456
AUTH_OTP_HASH_SECRET=replace-with-a-long-random-secret
```

`POSTGRES_URL` is required for report persistence. On Render, set it to the database's internal PostgreSQL URL; production rejects localhost URLs. In `CDW_INFERENCE_MODE=prototype`, image storage is disabled and `BLOB_READ_WRITE_TOKEN` is ignored. In production mode, configure a valid Vercel `BLOB_READ_WRITE_TOKEN` on Render.

`CDW_INFERENCE_MODE=prototype` makes `/api/analyze` generate deterministic local mock analysis and does not call `AI_API_URL`, `AI_SERVICE_URL`, localhost inference services, PostgreSQL, or Blob storage. External inference is used only when `CDW_INFERENCE_MODE=production`; then configure `AI_API_URL` or `AI_SERVICE_URL` (for example, `https://ai.example.com`). `NEXT_PUBLIC_AI_API_URL` is also accepted for deployment compatibility, but API keys and service tokens must stay server-only; never put secrets in `NEXT_PUBLIC_*` variables.

## Database

The PostgreSQL schema is in `db/schema.ts`; generated SQL migrations are in `drizzle/`.

```text
npm run db:generate
```

Apply the generated migration through your PostgreSQL provider before using `/api/reports`.

For Render Blueprint deployments, [render.yaml](./render.yaml) runs `npm run db:migrate` as the pre-deploy command. The migration command applies the checked-in SQL and then verifies that `public.waste_reports` exists with every column required by the report insert. For an existing manually configured Render service, set the same pre-deploy command in the service settings.

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

Demo OTP mode accepts any complete six-digit code only when `DEMO_OTP_MODE=true`. Production mode still verifies the generated, expiring OTP. OTP values are never returned by the authentication API.

After deploying to Render with its database configured, run the authenticated upload, analysis, and report-confirmation smoke test with `npm run smoke:analyze -- https://your-service.onrender.com`. Add `--skip-report` only for environments without report persistence.

## Model limitation

The repository does not include trained model weights or calibrated field measurements. The fallback analyser is a deterministic software prototype and must not be treated as a scientifically validated quantity estimate.
