from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import DATA_DIR, Base, engine
from .routers import notes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="BudaiNodes API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)

UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _migrate():
    """Add columns that don't exist yet on an existing table (dev migrations)."""
    import sqlite3

    with engine.connect() as conn:
        conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
        if conn.exec_driver_sql(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='notes'"
        ).fetchone():
            has_folder = conn.exec_driver_sql(
                "SELECT 1 FROM pragma_table_info('notes') WHERE name='folder'"
            ).fetchone()
            has_deleted = conn.exec_driver_sql(
                "SELECT 1 FROM pragma_table_info('notes') WHERE name='deleted_at'"
            ).fetchone()
            if not has_folder:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN folder VARCHAR(200) DEFAULT ''")
            if not has_deleted:
                conn.exec_driver_sql(
                    "ALTER TABLE notes ADD COLUMN deleted_at DATETIME"
                )
            conn.commit()


_migrate()