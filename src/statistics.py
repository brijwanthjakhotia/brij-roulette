"""Statistical analysis for dealer signature detection."""

import numpy as np
import pandas as pd
from scipy import stats

from src.wheel import WHEEL_ORDER, NUMBER_TO_POSITION, SECTORS, TOTAL_POCKETS


def frequency_distribution(spins_df: pd.DataFrame) -> pd.DataFrame:
    """Compute frequency distribution of spin results on the physical wheel.

    Returns DataFrame with columns:
        number, count, expected, deviation_pct, wheel_position, probability
    """
    total = len(spins_df)
    if total == 0:
        return pd.DataFrame(columns=[
            "number", "count", "expected", "deviation_pct", "wheel_position", "probability"
        ])

    expected = total / TOTAL_POCKETS

    # Count occurrences of each number
    counts = spins_df["result_number"].value_counts()

    rows = []
    for num in WHEEL_ORDER:
        count = int(counts.get(num, 0))
        dev = ((count - expected) / expected * 100) if expected > 0 else 0
        rows.append({
            "number": num,
            "count": count,
            "expected": round(expected, 2),
            "deviation_pct": round(dev, 1),
            "wheel_position": NUMBER_TO_POSITION[num],
            "probability": count / total if total > 0 else 0,
        })

    return pd.DataFrame(rows)


def chi_squared_test(spins_df: pd.DataFrame) -> dict:
    """Run chi-squared goodness-of-fit test for uniform distribution.

    Returns dict with: chi2, p_value, df, is_significant, sample_size, min_expected.
    """
    total = len(spins_df)
    if total == 0:
        return {"chi2": 0, "p_value": 1.0, "df": 36, "is_significant": False,
                "sample_size": 0, "min_expected": 0}

    expected = total / TOTAL_POCKETS
    counts = spins_df["result_number"].value_counts()
    observed = np.array([counts.get(num, 0) for num in range(TOTAL_POCKETS)])
    expected_arr = np.full(TOTAL_POCKETS, expected)

    chi2_stat, p_value = stats.chisquare(observed, f_exp=expected_arr)

    return {
        "chi2": round(float(chi2_stat), 3),
        "p_value": round(float(p_value), 6),
        "df": TOTAL_POCKETS - 1,
        "is_significant": p_value < 0.05,
        "sample_size": total,
        "min_expected": round(expected, 2),
    }


def sector_frequencies(spins_df: pd.DataFrame) -> pd.DataFrame:
    """Compute frequency distribution by wheel sector.

    Returns DataFrame with columns: sector, numbers, count, expected, deviation_pct, probability.
    """
    total = len(spins_df)
    if total == 0:
        return pd.DataFrame(columns=["sector", "numbers", "count", "expected", "deviation_pct", "probability"])

    counts = spins_df["result_number"].value_counts()
    rows = []

    for sector_name, numbers in SECTORS.items():
        sector_count = sum(int(counts.get(n, 0)) for n in numbers)
        expected = total * len(numbers) / TOTAL_POCKETS
        dev = ((sector_count - expected) / expected * 100) if expected > 0 else 0
        rows.append({
            "sector": sector_name,
            "numbers": numbers,
            "count": sector_count,
            "expected": round(expected, 2),
            "deviation_pct": round(dev, 1),
            "probability": sector_count / total if total > 0 else 0,
        })

    return pd.DataFrame(rows)


def sector_chi_squared(spins_df: pd.DataFrame) -> dict:
    """Chi-squared test on sector-level distribution."""
    total = len(spins_df)
    if total == 0:
        return {"chi2": 0, "p_value": 1.0, "df": 5, "is_significant": False, "sample_size": 0}

    counts = spins_df["result_number"].value_counts()
    observed = []
    expected = []

    for sector_name, numbers in SECTORS.items():
        sector_count = sum(int(counts.get(n, 0)) for n in numbers)
        sector_expected = total * len(numbers) / TOTAL_POCKETS
        observed.append(sector_count)
        expected.append(sector_expected)

    chi2_stat, p_value = stats.chisquare(observed, f_exp=expected)
    return {
        "chi2": round(float(chi2_stat), 3),
        "p_value": round(float(p_value), 6),
        "df": len(SECTORS) - 1,
        "is_significant": p_value < 0.05,
        "sample_size": total,
    }


def conditional_analysis(spins_df: pd.DataFrame, condition_col: str) -> dict[str, pd.DataFrame]:
    """Split spins by a condition column and compute frequency distribution for each.

    Returns dict mapping each condition value to its frequency DataFrame.
    """
    result = {}
    if condition_col not in spins_df.columns:
        return result

    valid = spins_df[spins_df[condition_col].notna() & (spins_df[condition_col] != "")]
    for val in sorted(valid[condition_col].unique()):
        subset = valid[valid[condition_col] == val]
        if len(subset) > 0:
            result[str(val)] = frequency_distribution(subset)

    return result


def confidence_level(sample_size: int, p_value: float) -> str:
    """Determine confidence level based on sample size and p-value."""
    if sample_size < 50:
        return "low"
    if sample_size < 150 or p_value > 0.05:
        return "medium"
    return "high"


def confidence_badge(level: str) -> str:
    """Return a styled badge string for the confidence level."""
    badges = {
        "low": "🔴 Insufficient Data",
        "medium": "🟡 Suggestive",
        "high": "🟢 Statistically Significant",
    }
    return badges.get(level, "⚪ Unknown")
