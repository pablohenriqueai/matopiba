import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4
from app.core.config import DB_PATH


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY, created_at TEXT NOT NULL, filename TEXT NOT NULL,
            model TEXT NOT NULL, result TEXT NOT NULL, confidence REAL,
            payload TEXT NOT NULL, annotated_path TEXT
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_analyses_model ON analyses(model)")


def insert(filename: str, model: str, result: str, confidence: float | None, payload: dict, annotated_path: str | None = None):
    item = {"id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), "filename": filename,
            "model": model, "result": result, "confidence": confidence, "payload": payload, "annotated_path": annotated_path}
    with connect() as db:
        db.execute("INSERT INTO analyses VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (item["id"], item["created_at"], filename, model, result, confidence, json.dumps(payload), annotated_path))
    return item


def list_items(model: str | None = None, date_from: str | None = None, date_to: str | None = None, q: str | None = None, limit: int = 100, offset: int = 0):
    clauses, args = [], []
    if model:
        clauses.append("model = ?"); args.append(model)
    if date_from:
        clauses.append("created_at >= ?"); args.append(date_from)
    if date_to:
        clauses.append("created_at < ?"); args.append(date_to)
    if q:
        clauses.append("filename LIKE ?"); args.append(f"%{q}%")
    sql = "SELECT * FROM analyses" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    args.extend([min(limit, 200), max(offset, 0)])
    with connect() as db:
        rows = db.execute(sql, args).fetchall()
    return [_serialize(row) for row in rows]


def get_item(item_id: str):
    with connect() as db:
        row = db.execute("SELECT * FROM analyses WHERE id = ?", (item_id,)).fetchone()
    return _serialize(row) if row else None


def _serialize(row):
    if row is None:
        return None
    return {"id": row["id"], "created_at": row["created_at"], "filename": row["filename"], "model": row["model"],
            "result": row["result"], "confidence": row["confidence"], "payload": json.loads(row["payload"]), "annotated_path": row["annotated_path"]}
