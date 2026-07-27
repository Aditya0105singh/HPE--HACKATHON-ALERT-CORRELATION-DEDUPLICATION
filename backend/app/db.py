"""SQLite persistence layer.

Alerts and clustering are still recomputed in-memory on every pipeline run
(see main.py) — that part of the architecture doesn't need a database. What
was missing is durability: raw ingested alerts and user actions (ack/assign/
dismiss/escalate) lived only in the `_state` dict and the frontend's React
state, so a backend restart or page refresh silently threw them away.

This module gives those two things a home:
  - `alerts` table: every raw alert ever ingested/generated, so a restart
    doesn't lose history.
  - `alert_actions` table: one row per alert id holding the user-applied
    overrides (ack, assignee, status override, escalated), keyed so they
    survive independently of whatever batch the alert came from.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import Column, String, Boolean, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = Path(__file__).resolve().parents[1] / "alertlens.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class AlertRow(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True)
    payload = Column(String, nullable=False)  # full alert dict, JSON-encoded
    timestamp = Column(DateTime, nullable=False)


class AlertAction(Base):
    __tablename__ = "alert_actions"

    alert_id = Column(String, primary_key=True)
    acked = Column(Boolean, default=False)
    assignee = Column(String, nullable=True)
    status_override = Column(String, nullable=True)  # "suppressed" | "resolved" | None
    escalated = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    Base.metadata.create_all(engine)


def save_alerts(alerts: list[dict]) -> None:
    """Upsert a batch of raw alerts (id is the natural key)."""
    if not alerts:
        return
    with SessionLocal() as db:
        for a in alerts:
            ts = a["timestamp"]
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            existing = db.get(AlertRow, a["id"])
            payload = json.dumps(a, default=str)
            if existing:
                existing.payload = payload
                existing.timestamp = ts
            else:
                db.add(AlertRow(id=a["id"], payload=payload, timestamp=ts))
        db.commit()


def load_alerts() -> list[dict]:
    with SessionLocal() as db:
        rows = db.query(AlertRow).order_by(AlertRow.timestamp.desc()).all()
        return [json.loads(r.payload) for r in rows]


def clear_alerts() -> None:
    """Used before persisting a fresh batch (new demo batch, dataset switch,
    or /ingest payload) so the alerts table always mirrors exactly what's
    currently shown, rather than accumulating every batch ever loaded.

    Deliberately leaves alert_actions alone: on a plain backend restart,
    run_pipeline() re-saves the *same* persisted alerts (same ids), and
    actions taken on them must survive that round-trip. Rows for ids that
    genuinely never reappear (e.g. after a real dataset switch) just become
    inert — cheap enough to leave as-is rather than add clear-on-switch
    logic that would risk wiping actions on the restart path too."""
    with SessionLocal() as db:
        db.query(AlertRow).delete()
        db.commit()


def get_actions() -> dict[str, dict]:
    with SessionLocal() as db:
        rows = db.query(AlertAction).all()
        return {
            r.alert_id: {
                "acked": r.acked,
                "assignee": r.assignee,
                "status_override": r.status_override,
                "escalated": r.escalated,
            }
            for r in rows
        }


def _get_or_create_action(db, alert_id: str) -> AlertAction:
    action = db.get(AlertAction, alert_id)
    if not action:
        action = AlertAction(alert_id=alert_id)
        db.add(action)
    return action


def set_ack(alert_id: str, value: bool) -> None:
    with SessionLocal() as db:
        action = _get_or_create_action(db, alert_id)
        action.acked = value
        action.updated_at = datetime.utcnow()
        db.commit()


def set_assignee(alert_id: str, assignee: str | None) -> None:
    with SessionLocal() as db:
        action = _get_or_create_action(db, alert_id)
        action.assignee = assignee
        action.updated_at = datetime.utcnow()
        db.commit()


def set_status_override(alert_id: str, status: str | None) -> None:
    with SessionLocal() as db:
        action = _get_or_create_action(db, alert_id)
        action.status_override = status
        action.updated_at = datetime.utcnow()
        db.commit()


def set_escalated(alert_id: str, value: bool) -> None:
    with SessionLocal() as db:
        action = _get_or_create_action(db, alert_id)
        action.escalated = value
        action.updated_at = datetime.utcnow()
        db.commit()
