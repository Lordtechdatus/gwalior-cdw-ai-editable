# Python inference service

This service is the replacement boundary between the web platform and the validated computer-vision pipeline.

## Windows development mode

The API runs at <http://localhost:8000>. Its health endpoint is <http://localhost:8000/health>.

### Command Prompt

```bat
cd "C:\path\to\gwalior-cdw-ai-editable\services\ai-api"
rmdir /s /q .venv
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
set CDW_INFERENCE_MODE=prototype
python -m uvicorn app.main:app --reload --port 8000
```

For later starts, run `run_windows.cmd`. It changes to this directory, creates `.venv` only when necessary, installs the prototype requirements, and starts the API without deleting the environment.

### PowerShell

```powershell
Set-Location "C:\path\to\gwalior-cdw-ai-editable\services\ai-api"
Remove-Item -Path ".venv" -Recurse -Force -ErrorAction SilentlyContinue
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:CDW_INFERENCE_MODE="prototype"
python -m uvicorn app.main:app --reload --port 8000
```

The removal commands are only for recreating a broken environment. The prototype requirements intentionally exclude NumPy and Pillow, so Python 3.14 users are not forced to compile NumPy. If model inference later needs those packages, keep them in a separate `requirements-models.txt` rather than adding them to the prototype installation.

The prototype engine is deterministic and is deliberately labelled as unvalidated. It only tests transport, validation, calculations, and UI integration.

## Production model contract

Place the following artifacts in `CDW_MODEL_DIR`:

- `classification.keras`
- `segmentation.keras`
- `class_map.json`

Production mode intentionally remains blocked until the exact preprocessing, segmentation output, depth calibration, and confidence contracts are implemented and tested against ground truth.

Production environment variables must be set using the syntax appropriate to the active shell. Do not enable production mode until the model contract is implemented.
