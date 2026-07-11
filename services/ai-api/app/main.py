from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from .inference import ModelNotReadyError, create_engine


app = FastAPI(
    title="Gwalior C&D Waste Inference API",
    version="0.1.0",
    description="Replaceable inference boundary for the C&D waste operations platform.",
)


def require_service_token(authorization: str | None) -> None:
    expected = os.getenv("AI_SERVICE_TOKEN", "").strip()
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid service token.")


@app.get("/health")
def health() -> dict[str, str]:
    mode = os.getenv("CDW_INFERENCE_MODE", "prototype").strip().lower()
    return {"status": "ok", "inferenceMode": mode}


@app.post("/v1/analyze")
async def analyse(
    image: UploadFile = File(...),
    camera_height: float = Form(3.0, ge=1.0, le=8.0),
    fov: float = Form(60.0, ge=30.0, le=120.0),
    authorization: str | None = Header(default=None),
) -> dict:
    require_service_token(authorization)
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are accepted.")

    data = await image.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The image must be between 1 byte and 10 MB.")

    try:
        engine = create_engine()
        return engine.analyse(data, camera_height, fov)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
