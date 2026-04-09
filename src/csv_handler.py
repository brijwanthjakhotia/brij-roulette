"""CSV import/export for spin data."""

import io
from datetime import datetime

import pandas as pd

from src.database import get_connection, get_or_create_dealer, bulk_insert_spins
from src.models import BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, BALL_DIRECTIONS

REQUIRED_COLUMNS = ["dealer_name", "result_number"]
OPTIONAL_COLUMNS = ["ball_size", "spin_speed", "wheel_speed", "ball_direction",
                     "session_tag", "notes", "recorded_at"]

VALID_VALUES = {
    "ball_size": set(BALL_SIZES) | {None, "", "nan"},
    "spin_speed": set(SPIN_SPEEDS) | {None, "", "nan"},
    "wheel_speed": set(WHEEL_SPEEDS) | {None, "", "nan"},
    "ball_direction": set(BALL_DIRECTIONS) | {None, "", "nan"},
}


def validate_csv(uploaded_file) -> tuple[bool, list[str], pd.DataFrame | None]:
    """Validate an uploaded CSV file.

    Returns (is_valid, error_messages, preview_dataframe).
    """
    errors = []
    try:
        df = pd.read_csv(uploaded_file)
    except Exception as e:
        return False, [f"Could not parse CSV: {e}"], None

    # Check required columns
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            errors.append(f"Missing required column: '{col}'")

    if errors:
        return False, errors, df.head()

    # Validate result_number range
    invalid_nums = df[~df["result_number"].between(0, 36)]
    if not invalid_nums.empty:
        errors.append(
            f"{len(invalid_nums)} rows have result_number outside 0-36 "
            f"(rows: {invalid_nums.index.tolist()[:5]})"
        )

    # Validate enum fields
    for col, valid in VALID_VALUES.items():
        if col in df.columns:
            df[col] = df[col].astype(str).replace("nan", "")
            invalid = df[~df[col].isin(valid) & (df[col] != "")]
            if not invalid.empty:
                bad_vals = invalid[col].unique()[:5].tolist()
                errors.append(f"Invalid values in '{col}': {bad_vals}")

    is_valid = len(errors) == 0
    return is_valid, errors, df.head(10)


def import_csv(uploaded_file) -> tuple[int, int, list[str]]:
    """Import spins from CSV. Auto-creates dealers if needed.

    Returns (n_imported, n_skipped, errors).
    """
    df = pd.read_csv(uploaded_file)
    errors = []
    n_imported = 0
    n_skipped = 0

    # Clean up enum fields
    for col in VALID_VALUES:
        if col in df.columns:
            df[col] = df[col].astype(str).replace("nan", "")
            df[col] = df[col].apply(lambda x: x if x in VALID_VALUES[col] and x != "" else None)

    # Resolve dealer IDs
    dealer_ids = {}
    for name in df["dealer_name"].unique():
        name_str = str(name).strip()
        if name_str and name_str != "nan":
            dealer_ids[name_str] = get_or_create_dealer(name_str)

    # Build insert DataFrame
    rows_to_insert = []
    for idx, row in df.iterrows():
        dealer_name = str(row["dealer_name"]).strip()
        if dealer_name not in dealer_ids:
            n_skipped += 1
            errors.append(f"Row {idx}: empty dealer name, skipped")
            continue

        result_num = row["result_number"]
        if not (0 <= int(result_num) <= 36):
            n_skipped += 1
            errors.append(f"Row {idx}: invalid result_number {result_num}, skipped")
            continue

        rows_to_insert.append({
            "dealer_id": dealer_ids[dealer_name],
            "result_number": int(result_num),
            "ball_size": row.get("ball_size") if pd.notna(row.get("ball_size")) else None,
            "spin_speed": row.get("spin_speed") if pd.notna(row.get("spin_speed")) else None,
            "wheel_speed": row.get("wheel_speed") if pd.notna(row.get("wheel_speed")) else None,
            "ball_direction": row.get("ball_direction") if pd.notna(row.get("ball_direction")) else None,
            "session_tag": str(row.get("session_tag", "")) if pd.notna(row.get("session_tag")) else "",
            "notes": str(row.get("notes", "")) if pd.notna(row.get("notes")) else "",
            "recorded_at": str(row.get("recorded_at", "")) if pd.notna(row.get("recorded_at")) else datetime.now().isoformat(),
        })

    if rows_to_insert:
        insert_df = pd.DataFrame(rows_to_insert)
        bulk_insert_spins(insert_df)
        n_imported = len(rows_to_insert)

    return n_imported, n_skipped, errors


def export_csv(dealer_id: int = None) -> str:
    """Export spins to CSV string. If dealer_id is None, exports all."""
    conn = get_connection()

    if dealer_id:
        query = """
            SELECT d.name as dealer_name, s.result_number, s.ball_size, s.spin_speed,
                   s.wheel_speed, s.ball_direction, s.session_tag, s.notes, s.recorded_at
            FROM spins s JOIN dealers d ON s.dealer_id = d.id
            WHERE s.dealer_id = ?
            ORDER BY s.recorded_at
        """
        df = pd.read_sql_query(query, conn, params=(dealer_id,))
    else:
        query = """
            SELECT d.name as dealer_name, s.result_number, s.ball_size, s.spin_speed,
                   s.wheel_speed, s.ball_direction, s.session_tag, s.notes, s.recorded_at
            FROM spins s JOIN dealers d ON s.dealer_id = d.id
            ORDER BY d.name, s.recorded_at
        """
        df = pd.read_sql_query(query, conn)

    return df.to_csv(index=False)
