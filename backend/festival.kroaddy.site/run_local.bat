@echo off
REM Docker에서 "Name or service not known" 나오면, 호스트에서 이걸로 실행하세요 (상위 .env 사용).
cd /d "%~dp0"
pip install -q -r requirements.txt 2>nul
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
