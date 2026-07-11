# Python inference service

This service is the replacement boundary between the web platform and the validated computer-vision pipeline.

## Development mode

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
CDW_INFERENCE_MODE=prototype uvicorn app.main:app --reload
```

The prototype engine is deterministic and is deliberately labelled as unvalidated. It only tests transport, validation, calculations, and UI integration.

## Production model contract

Place the following artifacts in `CDW_MODEL_DIR`:

- `classification.keras`
- `segmentation.keras`
- `class_map.json`

Production mode intentionally remains blocked until the exact preprocessing, segmentation output, depth calibration, and confidence contracts are implemented and tested against ground truth.

```bash
CDW_INFERENCE_MODE=production CDW_MODEL_DIR=/models uvicorn app.main:app
```
