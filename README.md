# Nirmal Gwalior C&D Waste Intelligence

A role-based construction and demolition waste management platform derived from the Gwalior Smart City project report. The application connects image-assisted waste reporting with collection scheduling, recycler verification, compliance review, and environmental analytics.

## Current build

- Responsive public project entry page
- Waste Generator, Recycler, and Authority workspaces
- Site-image upload and validation
- Replaceable inference API boundary
- Clearly labelled deterministic prototype analyser
- Material-wise area, volume, mass, and CO₂ calculations
- Low-confidence manual-review routing
- Collection and recycling workflow interfaces
- D1 relational schema with a generated migration
- R2 image-storage endpoint
- Server-attributed report and audit records

## Important limitation

The supplied report does not include the trained model weights, complete training code, calibrated depth ground truth, or verified emission-accounting contract. The running prototype therefore does not claim scientific image-measurement accuracy. It is a complete software workflow with an explicit adapter for the real models.

## Application architecture

```text
Web workspace (Vinext/React)
  ├── /api/analyze  → external Python service when configured
  │                   → deterministic prototype otherwise
  ├── /api/uploads  → R2 image storage
  ├── /api/reports  → D1 report, estimate, and status records
  └── role workspaces
       ├── Generator: capture, analyse, submit, track
       ├── Recycler: receive, weigh, recover, certify
       └── Authority: review, schedule, audit, monitor
```

## Project structure

```text
app/                    Web interface and server routes
db/                     Drizzle/D1 schema
drizzle/                Generated SQL migration
services/ai-api/        Python FastAPI inference boundary
worker/                 Cloudflare worker entry
.openai/hosting.json    Sites persistence bindings
```

## Development steps

1. Install the locked web dependencies with `npm run install:ci`.
2. Start the web application with `npm run dev`.
3. Optionally start `services/ai-api` in prototype mode.
4. Set `AI_SERVICE_URL` to route analysis through the Python service.
5. Generate a new migration with `npm run db:generate` after schema changes.
6. Run `npm run lint`, `npm test`, and `npm run build` before release.

## Real-model integration requirements

The next scientific milestone requires:

- Classification and segmentation model weights
- Exact class-index mapping
- Original image preprocessing code
- Manually annotated segmentation test masks
- Metric depth or measured-volume calibration dataset
- Versioned and defensible CO₂ factors
- Site/pile-grouped validation split

Do not enable production inference until these requirements are met.
