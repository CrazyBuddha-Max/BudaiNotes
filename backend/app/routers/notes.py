import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import DATA_DIR, engine, get_db
from ..models import Note
from ..schemas import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/api/notes", tags=["notes"])

UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_note(db: Session, note_id: int) -> Note:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("", response_model=list[NoteOut])
def list_notes(
    q: str = "",
    deleted: int = 0,
    folder: str = "",
    db: Session = Depends(get_db),
):
    query = db.query(Note)
    if deleted:
        query = query.filter(Note.deleted_at.isnot(None))
    else:
        query = query.filter(Note.deleted_at.is_(None))
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    Note.title.like(like),
                    Note.content.like(like),
                    Note.tags.like(like),
                    Note.folder.like(like),
                )
            )
        if folder:
            query = query.filter(Note.folder == folder)
    notes = query.order_by(Note.pinned.desc(), Note.updated_at.desc()).all()
    return notes


@router.post("", response_model=NoteOut)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    note = Note(**payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/upload")
async def upload_image(file: UploadFile):
    ext = Path(file.filename or "img.png").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    dest = UPLOAD_DIR / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"url": f"/uploads/{name}", "name": file.filename}


@router.get("/export")
def export_notes(db: Session = Depends(get_db)):
    notes = (
        db.query(Note)
        .filter(Note.deleted_at.is_(None))
        .order_by(Note.created_at)
        .all()
    )
    data = [
        {
            "title": n.title,
            "content": n.content,
            "tags": n.tags,
            "folder": n.folder,
            "pinned": bool(n.pinned),
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }
        for n in notes
    ]
    return {"exported_at": _now().isoformat(), "count": len(data), "notes": data}


@router.post("/import")
def import_notes(payload: dict, db: Session = Depends(get_db)):
    notes = payload.get("notes", [])
    if not isinstance(notes, list):
        raise HTTPException(status_code=400, detail="格式错误：缺少 notes 数组")
    count = 0
    for item in notes:
        note = Note(
            title=str(item.get("title", "")),
            content=str(item.get("content", "")),
            tags=str(item.get("tags", "")),
            folder=str(item.get("folder", "")),
            pinned=int(bool(item.get("pinned", False))),
        )
        db.add(note)
        count += 1
    db.commit()
    return {"imported": count}


@router.get("/backup")
def backup_database():
    db_path = Path(str(engine.url).replace("sqlite:///", ""))
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="数据库文件不存在")
    filename = f"budainodes-backup-{_now().strftime('%Y%m%d-%H%M%S')}.db"
    return FileResponse(
        db_path,
        media_type="application/octet-stream",
        filename=filename,
    )


@router.get("/{note_id}", response_model=NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)):
    return _get_note(db, note_id)


@router.put("/{note_id}", response_model=NoteOut)
def update_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = _get_note(db, note_id)
    data = payload.model_dump(exclude_unset=True)
    if "pinned" in data:
        note.pinned = int(data.pop("pinned"))
    for key, value in data.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.post("/{note_id}/trash")
def trash_note(note_id: int, db: Session = Depends(get_db)):
    note = _get_note(db, note_id)
    note.deleted_at = _now()
    db.commit()
    return {"ok": True}


@router.post("/{note_id}/restore")
def restore_note(note_id: int, db: Session = Depends(get_db)):
    note = _get_note(db, note_id)
    note.deleted_at = None
    db.commit()
    return {"ok": True}


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = _get_note(db, note_id)
    db.delete(note)
    db.commit()
    return {"ok": True}


@router.delete("")
def empty_trash(db: Session = Depends(get_db)):
    count = (
        db.query(Note).filter(Note.deleted_at.isnot(None)).delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": count}
