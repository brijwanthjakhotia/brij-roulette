"""Prediction engine — dealer signature-based probability estimation."""

import numpy as np
from scipy import stats as sp_stats

from src.wheel import WHEEL_ORDER, NUMBER_TO_POSITION, SECTORS, TOTAL_POCKETS
from src.models import PredictionResult
from src.statistics import chi_squared_test, confidence_level


def _laplace_smooth(counts: np.ndarray, alpha: float = 0.5) -> np.ndarray:
    """Apply Laplace (additive) smoothing to prevent zero probabilities."""
    smoothed = counts + alpha
    return smoothed / smoothed.sum()


def _gaussian_kernel_smooth(probs: np.ndarray, sigma: float = 2.0) -> np.ndarray:
    """Apply circular Gaussian kernel smoothing on the physical wheel.

    This captures the physical reality that a dealer hitting one pocket
    also elevates the probability of nearby pockets on the wheel.
    """
    n = len(probs)
    smoothed = np.zeros(n)

    for i in range(n):
        for j in range(n):
            # Circular distance on the wheel
            dist = min(abs(i - j), n - abs(i - j))
            weight = np.exp(-(dist ** 2) / (2 * sigma ** 2))
            smoothed[i] += probs[j] * weight

    # Normalize to sum to 1
    return smoothed / smoothed.sum()


def predict(spins_df, top_n: int = 5, kernel_sigma: float = 2.0,
            alpha: float = 0.5) -> PredictionResult:
    """Generate predictions based on dealer spin history.

    Args:
        spins_df: DataFrame of spins (already filtered by dealer + conditions).
        top_n: Number of top numbers to return.
        kernel_sigma: Width of Gaussian kernel (in wheel positions).
        alpha: Laplace smoothing parameter.

    Returns:
        PredictionResult with ranked numbers, sectors, and confidence.
    """
    sample_size = len(spins_df)

    if sample_size == 0:
        return PredictionResult(
            ranked_numbers=[],
            sector_rankings=[],
            confidence="low",
            sample_size=0,
            p_value=1.0,
        )

    # Count hits per wheel position
    counts = np.zeros(TOTAL_POCKETS)
    result_counts = spins_df["result_number"].value_counts()
    for num, count in result_counts.items():
        pos = NUMBER_TO_POSITION[int(num)]
        counts[pos] = count

    # Step 1: Laplace smoothing
    probs = _laplace_smooth(counts, alpha)

    # Step 2: Gaussian kernel smoothing on physical wheel
    probs = _gaussian_kernel_smooth(probs, kernel_sigma)

    # Step 3: Compute chi-squared and confidence
    chi2 = chi_squared_test(spins_df)
    conf = confidence_level(sample_size, chi2["p_value"])

    # Step 4: Rank numbers by probability
    fair_prob = 1 / TOTAL_POCKETS
    ranked = []
    for pos in range(TOTAL_POCKETS):
        num = WHEEL_ORDER[pos]
        prob = float(probs[pos])
        advantage = (prob - fair_prob) / fair_prob * 100
        ranked.append((num, prob, round(advantage, 1)))

    ranked.sort(key=lambda x: x[1], reverse=True)

    # Step 5: Rank sectors by aggregate probability
    sector_rankings = []
    for sector_name, numbers in SECTORS.items():
        sector_prob = sum(
            float(probs[NUMBER_TO_POSITION[n]]) for n in numbers
        )
        sector_rankings.append((sector_name, round(sector_prob, 4)))

    sector_rankings.sort(key=lambda x: x[1], reverse=True)

    return PredictionResult(
        ranked_numbers=ranked[:top_n],
        sector_rankings=sector_rankings,
        confidence=conf,
        sample_size=sample_size,
        p_value=chi2["p_value"],
    )
