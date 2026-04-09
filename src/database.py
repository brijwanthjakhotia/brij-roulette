"""SQLite database layer for the roulette dealer signature tracker."""

import sqlite3
import os
from datetime import datetime

import pandas as pd
import streamlit as st

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "roulette.db")


def get_connection() -> sqlite3.Connection:
    """Get or create a cached SQLite connection."""
    if "db_conn" not in st.session_state:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        st.session_state.db_conn = conn
        _init_schema(conn)
    return st.session_state.db_conn


def _init_schema(conn: sqlite3.Connection):
    """Create tables if they don't exist."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS dealers (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            notes       TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            dealer_id   INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            location    TEXT DEFAULT '',
            date        TEXT,
            notes       TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS spins (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            dealer_id       INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
            result_number   INTEGER NOT NULL CHECK(result_number >= 0 AND result_number <= 36),
            ball_size       TEXT CHECK(ball_size IN ('small', 'medium', 'large') OR ball_size IS NULL),
            spin_speed      TEXT CHECK(spin_speed IN ('slow', 'medium', 'fast') OR spin_speed IS NULL),
            wheel_speed     TEXT CHECK(wheel_speed IN ('slow', 'medium', 'fast') OR wheel_speed IS NULL),
            ball_direction  TEXT CHECK(ball_direction IN ('cw', 'ccw') OR ball_direction IS NULL),
            session_tag     TEXT DEFAULT '',
            notes           TEXT DEFAULT '',
            recorded_at     TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_spins_dealer ON spins(dealer_id);
        CREATE INDEX IF NOT EXISTS idx_spins_result ON spins(result_number);
    """)
    conn.commit()


# --- Dealer CRUD ---

def add_dealer(name: str, notes: str = "") -> int:
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO dealers (name, notes) VALUES (?, ?)",
        (name.strip(), notes.strip())
    )
    conn.commit()
    return cur.lastrowid


def get_dealers() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT d.*, COUNT(s.id) as spin_count
        FROM dealers d
        LEFT JOIN spins s ON d.id = s.dealer_id
        GROUP BY d.id
        ORDER BY d.name
    """).fetchall()
    return [dict(r) for r in rows]


def get_dealer(dealer_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM dealers WHERE id = ?", (dealer_id,)).fetchone()
    return dict(row) if row else None


def update_dealer(dealer_id: int, name: str, notes: str = ""):
    conn = get_connection()
    conn.execute(
        "UPDATE dealers SET name = ?, notes = ?, updated_at = ? WHERE id = ?",
        (name.strip(), notes.strip(), datetime.now().isoformat(), dealer_id)
    )
    conn.commit()


def delete_dealer(dealer_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM dealers WHERE id = ?", (dealer_id,))
    conn.commit()


def get_or_create_dealer(name: str) -> int:
    """Get dealer by name, or create if not found. Returns dealer id."""
    conn = get_connection()
    row = conn.execute("SELECT id FROM dealers WHERE name = ?", (name.strip(),)).fetchone()
    if row:
        return row["id"]
    return add_dealer(name)


# --- Spin CRUD ---

def add_spin(dealer_id: int, result_number: int, ball_size: str = None,
             spin_speed: str = None, wheel_speed: str = None,
             ball_direction: str = None, session_tag: str = "",
             notes: str = "") -> int:
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO spins
           (dealer_id, result_number, ball_size, spin_speed, wheel_speed,
            ball_direction, session_tag, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (dealer_id, result_number, ball_size, spin_speed, wheel_speed,
         ball_direction, session_tag.strip(), notes.strip())
    )
    conn.commit()
    return cur.lastrowid


def get_spins(dealer_id: int, filters: dict = None) -> pd.DataFrame:
    """Get spins for a dealer, optionally filtered by conditions.

    filters: dict like {"ball_size": "small", "ball_direction": "ccw"}
             None values are ignored.
    """
    conn = get_connection()
    query = "SELECT * FROM spins WHERE dealer_id = ?"
    params = [dealer_id]

    if filters:
        for col, val in filters.items():
            if val is not None and val != "" and val != "All":
                query += f" AND {col} = ?"
                params.append(val)

    query += " ORDER BY recorded_at DESC"
    return pd.read_sql_query(query, conn, params=params)


def get_spin_count(dealer_id: int, filters: dict = None) -> int:
    conn = get_connection()
    query = "SELECT COUNT(*) FROM spins WHERE dealer_id = ?"
    params = [dealer_id]

    if filters:
        for col, val in filters.items():
            if val is not None and val != "" and val != "All":
                query += f" AND {col} = ?"
                params.append(val)

    return conn.execute(query, params).fetchone()[0]


def get_recent_spins(dealer_id: int, limit: int = 20) -> pd.DataFrame:
    conn = get_connection()
    return pd.read_sql_query(
        "SELECT * FROM spins WHERE dealer_id = ? ORDER BY recorded_at DESC LIMIT ?",
        conn, params=(dealer_id, limit)
    )


def delete_spin(spin_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM spins WHERE id = ?", (spin_id,))
    conn.commit()


def delete_all_spins(dealer_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM spins WHERE dealer_id = ?", (dealer_id,))
    conn.commit()


def bulk_insert_spins(df: pd.DataFrame):
    """Insert spins from a DataFrame. Expects columns matching the spins table."""
    conn = get_connection()
    for _, row in df.iterrows():
        conn.execute(
            """INSERT INTO spins
               (dealer_id, result_number, ball_size, spin_speed, wheel_speed,
                ball_direction, session_tag, notes, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (row["dealer_id"], int(row["result_number"]),
             row.get("ball_size"), row.get("spin_speed"),
             row.get("wheel_speed"), row.get("ball_direction"),
             row.get("session_tag", ""), row.get("notes", ""),
             row.get("recorded_at", datetime.now().isoformat()))
        )
    conn.commit()


def get_total_stats() -> dict:
    """Get global statistics."""
    conn = get_connection()
    dealer_count = conn.execute("SELECT COUNT(*) FROM dealers").fetchone()[0]
    spin_count = conn.execute("SELECT COUNT(*) FROM spins").fetchone()[0]
    return {"dealer_count": dealer_count, "spin_count": spin_count}


def clear_all_data():
    """Delete all data from all tables."""
    conn = get_connection()
    conn.executescript("""
        DELETE FROM spins;
        DELETE FROM sessions;
        DELETE FROM dealers;
    """)
    conn.commit()
