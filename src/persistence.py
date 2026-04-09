"""Full database backup and restore as JSON."""

import json
from datetime import datetime

import streamlit as st
from src.database import get_connection, clear_all_data


def export_all() -> str:
    """Export all dealers, sessions, and spins to a JSON string."""
    conn = get_connection()

    dealers = [dict(r) for r in conn.execute("SELECT * FROM dealers ORDER BY id").fetchall()]
    sessions = [dict(r) for r in conn.execute("SELECT * FROM sessions ORDER BY id").fetchall()]
    spins = [dict(r) for r in conn.execute("SELECT * FROM spins ORDER BY id").fetchall()]

    data = {
        "exported_at": datetime.now().isoformat(),
        "version": 1,
        "dealers": dealers,
        "sessions": sessions,
        "spins": spins,
    }
    return json.dumps(data, indent=2)


def import_all(json_string: str):
    """Restore full database from JSON. Clears existing data first."""
    data = json.loads(json_string)
    conn = get_connection()

    clear_all_data()

    # Re-insert dealers with original IDs
    for d in data.get("dealers", []):
        conn.execute(
            "INSERT INTO dealers (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (d["id"], d["name"], d.get("notes", ""),
             d.get("created_at", ""), d.get("updated_at", ""))
        )

    # Re-insert sessions
    for s in data.get("sessions", []):
        conn.execute(
            "INSERT INTO sessions (id, dealer_id, name, location, date, notes, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (s["id"], s["dealer_id"], s["name"], s.get("location", ""),
             s.get("date", ""), s.get("notes", ""), s.get("created_at", ""))
        )

    # Re-insert spins
    for sp in data.get("spins", []):
        conn.execute(
            "INSERT INTO spins (id, dealer_id, result_number, ball_size, spin_speed, "
            "wheel_speed, ball_direction, session_tag, notes, recorded_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sp["id"], sp["dealer_id"], sp["result_number"],
             sp.get("ball_size"), sp.get("spin_speed"),
             sp.get("wheel_speed"), sp.get("ball_direction"),
             sp.get("session_tag", ""), sp.get("notes", ""),
             sp.get("recorded_at", ""))
        )

    conn.commit()
