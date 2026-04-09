"""Data models for the roulette dealer signature tracker."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


BALL_SIZES = ["small", "medium", "large"]
SPIN_SPEEDS = ["slow", "medium", "fast"]
WHEEL_SPEEDS = ["slow", "medium", "fast"]
BALL_DIRECTIONS = ["cw", "ccw"]


@dataclass
class Dealer:
    id: Optional[int] = None
    name: str = ""
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Spin:
    id: Optional[int] = None
    dealer_id: int = 0
    result_number: int = 0
    ball_size: Optional[str] = None
    spin_speed: Optional[str] = None
    wheel_speed: Optional[str] = None
    ball_direction: Optional[str] = None
    session_tag: str = ""
    notes: str = ""
    recorded_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Session:
    id: Optional[int] = None
    dealer_id: int = 0
    name: str = ""
    location: str = ""
    date: str = ""
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class PredictionResult:
    ranked_numbers: list  # [(number, probability, advantage_pct), ...]
    sector_rankings: list  # [(sector_name, aggregate_probability), ...]
    confidence: str  # "low", "medium", "high"
    sample_size: int = 0
    p_value: float = 1.0
