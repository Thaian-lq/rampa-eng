set -e
cd "$(dirname "$0")"
pip install -r backend/requirements.txt
(cd frontend && npm install && npm run build)
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
