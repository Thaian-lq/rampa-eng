@echo off
cd /d "%~dp0"
pip install -r backend\requirements.txt
cd frontend
call npm install
call npm run build
cd ..
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
