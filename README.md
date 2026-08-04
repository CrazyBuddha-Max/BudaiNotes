# BudaNodes

一款炫酷的本地笔记管理应用。

- 后端：Python + FastAPI + SQLAlchemy
- 存储：SQLite 本地数据库（`backend/budainodes.db`）
- 前端：Vite + React 19 + Astryx 设计系统
- 虚拟环境：`.venv`（位于项目根目录）

## 快速开始

```bash
# 一键启动（自动装依赖、起后端 + 前端）
./start.sh

# 或手动：
.venv/bin/uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1
cd frontend && npm install && npm run dev
```

打开 http://localhost:5173 使用。

## 功能

- 新建 / 编辑 / 删除笔记
- 全文搜索（标题、内容、标签）
- 置顶笔记、标签分类
- 暗色 / 亮色主题切换
- 炫酷动画背景与卡片效果
- 笔记数据实时保存到本地 SQLite

## 目录结构

```
BudaiNodes/
├── .venv/                 # Python 虚拟环境
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI 入口
│   │   ├── database.py    # SQLite 连接
│   │   ├── models.py      # 数据模型
│   │   ├── schemas.py     # Pydantic 模型
│   │   └── routers/notes.py  # 笔记 API
│   ├── requirements.txt
│   └── budainodes.db      # SQLite 数据库（自动生成）
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 主应用
│   │   ├── api.js         # API 封装
│   │   └── components/    # NoteCard / EditorDialog
│   └── package.json
├── start.sh
└── README.md
```

## API

| 方法 | 路径            | 说明               |
|------|-----------------|--------------------|
| GET  | /api/notes?q=   | 列出 / 搜索笔记     |
| POST | /api/notes      | 新建笔记           |
| GET  | /api/notes/{id} | 获取单篇笔记       |
| PUT  | /api/notes/{id} | 更新笔记           |
| DELETE | /api/notes/{id} | 删除笔记           |
