#!/bin/bash
set -e
cd "$(dirname "$0")"

PY=.venv/bin/python
if [ ! -x "$PY" ]; then
  echo "创建虚拟环境 .venv ..."
  python3 -m venv .venv
fi

echo "安装后端依赖 ..."
.venv/bin/pip install -q -r backend/requirements.txt

echo "安装前端依赖 ..."
(cd frontend && npm install)

echo "启动后端 http://127.0.0.1:8000 ..."
.venv/bin/uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1 &
BACK_PID=$!

echo "启动前端 http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait