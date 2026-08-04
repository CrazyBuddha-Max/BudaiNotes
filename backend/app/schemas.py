from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer


class NoteBase(BaseModel):
    title: str = ""
    content: str = ""
    tags: str = ""
    folder: str = ""


class NoteCreate(NoteBase):
    pass


class NoteUpdate(NoteBase):
    pinned: bool | None = None


class NoteOut(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pinned: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at", "deleted_at")
    def serialize_utc(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()