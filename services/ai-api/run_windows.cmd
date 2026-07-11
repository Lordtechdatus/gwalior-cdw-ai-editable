@echo off
setlocal

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv || exit /b 1
)

call ".venv\Scripts\activate.bat" || exit /b 1
python -m pip install -r requirements.txt || exit /b 1
set "CDW_INFERENCE_MODE=prototype"
python -m uvicorn app.main:app --reload --port 8000
