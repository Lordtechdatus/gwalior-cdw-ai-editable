from __future__ import annotations

import hashlib
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Material:
    name: str
    density: float
    co2_per_m3: float
    color: str


MATERIALS = (
    Material("Brick", 1800.0, 240.0, "#d97958"),
    Material("Concrete", 2400.0, 300.0, "#9fa9a6"),
    Material("Soil", 1600.0, 50.0, "#a5c778"),
    Material("Steel", 7850.0, 15700.0, "#8fb7d9"),
    Material("Wood", 600.0, -360.0, "#d7aa68"),
)


class ModelNotReadyError(RuntimeError):
    """Raised when production mode is selected without usable model artifacts."""


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


class PrototypeInferenceEngine:
    """Deterministic development adapter. It is not a trained vision model."""

    mode = "prototype"
    version = "prototype-0.1"

    def analyse(self, image_bytes: bytes, camera_height: float, fov: float) -> dict[str, Any]:
        digest = hashlib.sha256(image_bytes).digest()
        dominant_index = digest[0] % len(MATERIALS)
        dominant_probability = 0.56 + (digest[1] / 255.0) * 0.32
        weights = [0 if index == dominant_index else 8 + digest[index + 2] % 36 for index in range(len(MATERIALS))]
        remaining_total = sum(weights)
        probabilities = [
            dominant_probability
            if index == dominant_index
            else (1.0 - dominant_probability) * weights[index] / remaining_total
            for index in range(len(MATERIALS))
        ]

        ground_width = 2.0 * camera_height * math.tan(math.radians(fov / 2.0))
        coverage = 0.2 + (digest[8] / 255.0) * 0.48
        total_area = max(0.25, ground_width * ground_width * coverage * 0.42)
        effective_depth = 0.18 + (digest[9] / 255.0) * 0.68
        total_volume = total_area * effective_depth

        results = []
        for material, probability in zip(MATERIALS, probabilities, strict=True):
            volume = total_volume * probability
            results.append(
                {
                    "material": material.name,
                    "probability": _round(probability),
                    "areaM2": _round(total_area * probability),
                    "volumeM3": _round(volume),
                    "massKg": _round(volume * material.density, 2),
                    "co2Kg": _round(volume * material.co2_per_m3, 2),
                    "color": material.color,
                }
            )

        return {
            "analysisId": f"PROTO-{digest[:5].hex().upper()}",
            "mode": self.mode,
            "modelVersion": self.version,
            "dominantMaterial": MATERIALS[dominant_index].name,
            "confidence": _round(dominant_probability),
            "manualReviewRequired": dominant_probability < 0.7,
            "totalAreaM2": _round(total_area),
            "totalVolumeM3": _round(total_volume, 6),
            "totalMassKg": _round(sum(item["massKg"] for item in results), 2),
            "totalCo2Kg": _round(sum(item["co2Kg"] for item in results), 2),
            "materials": results,
            "message": "Deterministic prototype output; not validated for field measurement.",
        }


class ProductionInferenceEngine:
    """Integration boundary for validated classifier, segmenter, and depth models."""

    mode = "model"

    def __init__(self, model_directory: str) -> None:
        self.model_directory = Path(model_directory)
        self.classifier_path = self.model_directory / "classification.keras"
        self.segmenter_path = self.model_directory / "segmentation.keras"
        self.class_map_path = self.model_directory / "class_map.json"

        missing = [
            path.name
            for path in (self.classifier_path, self.segmenter_path, self.class_map_path)
            if not path.exists()
        ]
        if missing:
            raise ModelNotReadyError(
                "Production inference is unavailable. Missing artifacts: " + ", ".join(missing)
            )

        raise ModelNotReadyError(
            "Model artifacts were found, but their preprocessing and output contracts must be implemented and validated before production inference is enabled."
        )

    def analyse(self, image_bytes: bytes, camera_height: float, fov: float) -> dict[str, Any]:
        raise ModelNotReadyError("Production inference has not been configured.")


def create_engine() -> PrototypeInferenceEngine | ProductionInferenceEngine:
    mode = os.getenv("CDW_INFERENCE_MODE", "prototype").strip().lower()
    if mode == "prototype":
        return PrototypeInferenceEngine()
    if mode == "production":
        return ProductionInferenceEngine(os.getenv("CDW_MODEL_DIR", "/models"))
    raise ValueError("CDW_INFERENCE_MODE must be 'prototype' or 'production'.")
