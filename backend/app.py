from __future__ import annotations

import csv
import io
import json
import os
import sqlite3
import statistics
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("RAMPA_DB", ROOT / "backend" / "rampa.db"))
DIST = ROOT / "frontend" / "dist"

SCHEMA = """
CREATE TABLE IF NOT EXISTS experiments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('varredura', 'monte-carlo')),
    label       TEXT NOT NULL,
    params      TEXT NOT NULL,
    summary     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,
    student     TEXT NOT NULL,
    group_name  TEXT NOT NULL,
    phase       TEXT NOT NULL CHECK (phase IN ('pre', 'pos')),
    score       REAL NOT NULL CHECK (score BETWEEN 0 AND 100),
    answers     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_student ON quiz (group_name, student, phase);
"""


@contextmanager
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.executescript(SCHEMA)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Experiment(BaseModel):
    kind: Literal["varredura", "monte-carlo"]
    label: str = Field(max_length=300)
    params: dict[str, Any]
    summary: dict[str, Any]


class QuizIn(BaseModel):
    student: str = Field(min_length=1, max_length=40)
    group_name: str = Field(default="GERAL", max_length=40)
    phase: Literal["pre", "pos"]
    score: float = Field(ge=0, le=100)
    answers: list[int]


app = FastAPI(title="Rampa API", version="1.0.0", description="Simulador de forças e atrito — Projeto Integrado")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "db": str(DB_PATH.name)}


@app.get("/api/experiments")
def list_experiments(limit: int = 100):
    with db() as con:
        rows = con.execute("SELECT * FROM experiments ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{**dict(r), "params": json.loads(r["params"]), "summary": json.loads(r["summary"])} for r in rows]


@app.post("/api/experiments", status_code=201)
def create_experiment(e: Experiment):
    with db() as con:
        cur = con.execute(
            "INSERT INTO experiments (created_at, kind, label, params, summary) VALUES (?, ?, ?, ?, ?)",
            (now(), e.kind, e.label, json.dumps(e.params), json.dumps(e.summary)),
        )
    return {"id": cur.lastrowid}


@app.get("/api/quiz")
def list_quiz():
    with db() as con:
        rows = con.execute("SELECT * FROM quiz ORDER BY id").fetchall()
    return [{**dict(r), "answers": json.loads(r["answers"])} for r in rows]


@app.post("/api/quiz", status_code=201)
def create_quiz(q: QuizIn):
    with db() as con:
        cur = con.execute(
            "INSERT INTO quiz (created_at, student, group_name, phase, score, answers) VALUES (?, ?, ?, ?, ?, ?)",
            (now(), q.student.strip().upper(), (q.group_name or "GERAL").strip().upper(), q.phase, q.score, json.dumps(q.answers)),
        )
    return {"id": cur.lastrowid}


@app.delete("/api/quiz")
def clear_quiz():
    with db() as con:
        n = con.execute("DELETE FROM quiz").rowcount
    return {"deleted": n}


@app.get("/api/quiz/summary")
def quiz_summary():
    with db() as con:
        rows = con.execute(
            """
            SELECT group_name, student, phase, score FROM quiz q
            WHERE id = (SELECT MAX(id) FROM quiz WHERE group_name = q.group_name AND student = q.student AND phase = q.phase)
            """
        ).fetchall()
    pre = {(r["group_name"], r["student"]): r["score"] for r in rows if r["phase"] == "pre"}
    pos = {(r["group_name"], r["student"]): r["score"] for r in rows if r["phase"] == "pos"}
    pairs = [(pre[k], pos[k]) for k in pre if k in pos]
    out: dict[str, Any] = {
        "n_pre": len(pre),
        "n_pos": len(pos),
        "n_pares": len(pairs),
        "media_pre": statistics.fmean(pre.values()) if pre else None,
        "media_pos": statistics.fmean(pos.values()) if pos else None,
    }
    if pairs:
        mp = statistics.fmean(p for p, _ in pairs)
        mq = statistics.fmean(q for _, q in pairs)
        out["ganho_hake"] = (mq - mp) / (100 - mp) if mp < 100 else None
    if len(pairs) >= 2:
        try:
            from scipy import stats

            t = stats.ttest_rel([q for _, q in pairs], [p for p, _ in pairs])
            out["t_pareado"] = float(t.statistic)
            out["p_valor"] = float(t.pvalue)
        except Exception:
            pass
    return out


@app.get("/api/export/{table}.csv")
def export_csv(table: Literal["experiments", "quiz"]):
    with db() as con:
        rows = con.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
    if not rows:
        raise HTTPException(404, "Tabela vazia")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(rows[0].keys())
    w.writerows([tuple(r) for r in rows])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={table}.csv"})


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
