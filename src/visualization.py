"""Plotly visualization builders for the roulette dealer tracker."""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from src.wheel import (
    WHEEL_ORDER, NUMBER_TO_ANGLE, NUMBER_TO_POSITION, TOTAL_POCKETS,
    SECTORS, number_color,
)


def _wheel_colors() -> list[str]:
    """Return color list for each pocket in wheel order."""
    color_map = {"red": "#e63946", "black": "#2b2d42", "green": "#2a9d8f"}
    return [color_map[number_color(n)] for n in WHEEL_ORDER]


def wheel_heatmap(freq_df: pd.DataFrame, title: str = "Wheel Heatmap") -> go.Figure:
    """Polar bar chart showing hit frequency around the physical wheel."""
    if freq_df.empty:
        fig = go.Figure()
        fig.add_annotation(text="No data", showarrow=False, font=dict(size=20))
        return fig

    # Sort by wheel position
    df = freq_df.sort_values("wheel_position")
    angles = [NUMBER_TO_ANGLE[n] for n in df["number"]]
    width = 360 / TOTAL_POCKETS - 0.5

    # Color by deviation: blue (cold) -> white (neutral) -> red (hot)
    max_dev = max(abs(df["deviation_pct"].max()), abs(df["deviation_pct"].min()), 1)
    normalized = df["deviation_pct"] / max_dev  # -1 to 1

    colors = []
    for val in normalized:
        if val > 0:
            r, g, b = 230, int(57 + (1 - val) * 180), int(70 + (1 - val) * 180)
        else:
            r, g, b = int(42 + (1 + val) * 180), int(157 + (1 + val) * 80), int(143 + (1 + val) * 100)
        colors.append(f"rgb({r},{g},{b})")

    fig = go.Figure()

    fig.add_trace(go.Barpolar(
        r=df["count"].values,
        theta=angles,
        width=[width] * len(df),
        marker=dict(
            color=colors,
            line=dict(color="rgba(255,255,255,0.3)", width=1),
        ),
        text=[f"<b>{n}</b><br>Count: {c}<br>Dev: {d:+.1f}%"
              for n, c, d in zip(df["number"], df["count"], df["deviation_pct"])],
        hoverinfo="text",
    ))

    # Add expected line
    expected = df["expected"].iloc[0] if not df.empty else 0
    theta_ring = np.linspace(0, 360, 100)
    fig.add_trace(go.Scatterpolar(
        r=[expected] * 100,
        theta=theta_ring,
        mode="lines",
        line=dict(color="rgba(255,255,255,0.5)", width=1, dash="dash"),
        hoverinfo="skip",
        showlegend=False,
    ))

    fig.update_layout(
        title=title,
        polar=dict(
            angularaxis=dict(
                tickvals=[NUMBER_TO_ANGLE[n] for n in WHEEL_ORDER],
                ticktext=[str(n) for n in WHEEL_ORDER],
                direction="clockwise",
                rotation=90,
                tickfont=dict(size=9),
            ),
            radialaxis=dict(
                showticklabels=True,
                tickfont=dict(size=8),
            ),
            bgcolor="rgba(0,0,0,0)",
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=500,
        margin=dict(t=60, b=20, l=20, r=20),
        font=dict(color="white"),
    )

    return fig


def sector_donut(sector_df: pd.DataFrame, title: str = "Sector Distribution") -> go.Figure:
    """Donut chart showing sector-level hit distribution."""
    if sector_df.empty:
        fig = go.Figure()
        fig.add_annotation(text="No data", showarrow=False, font=dict(size=20))
        return fig

    sector_colors = ["#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261", "#264653"]

    fig = go.Figure(data=[go.Pie(
        labels=[f"Sector {row['sector']}" for _, row in sector_df.iterrows()],
        values=sector_df["count"].values,
        hole=0.4,
        marker=dict(colors=sector_colors[:len(sector_df)]),
        textinfo="label+percent",
        hovertemplate="<b>Sector %{label}</b><br>Count: %{value}<br>%{percent}<extra></extra>",
    )])

    fig.update_layout(
        title=title,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=400,
        font=dict(color="white"),
        margin=dict(t=60, b=20),
    )

    return fig


def frequency_bar(freq_df: pd.DataFrame, title: str = "Number Frequency") -> go.Figure:
    """Bar chart of all 37 numbers sorted by wheel position."""
    if freq_df.empty:
        fig = go.Figure()
        fig.add_annotation(text="No data", showarrow=False, font=dict(size=20))
        return fig

    df = freq_df.sort_values("wheel_position")
    pocket_colors = _wheel_colors()

    fig = go.Figure()

    fig.add_trace(go.Bar(
        x=[str(n) for n in df["number"]],
        y=df["count"],
        marker=dict(color=pocket_colors),
        text=df["count"],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Count: %{y}<br>Dev: %{customdata:+.1f}%<extra></extra>",
        customdata=df["deviation_pct"],
    ))

    # Expected line
    expected = df["expected"].iloc[0] if not df.empty else 0
    fig.add_hline(y=expected, line_dash="dash", line_color="rgba(255,255,255,0.5)",
                  annotation_text=f"Expected ({expected:.1f})")

    fig.update_layout(
        title=title,
        xaxis_title="Number (wheel order)",
        yaxis_title="Count",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=350,
        font=dict(color="white"),
        margin=dict(t=60, b=40),
    )

    return fig


def comparison_polar(freq_a: pd.DataFrame, freq_b: pd.DataFrame,
                     label_a: str, label_b: str) -> go.Figure:
    """Side-by-side polar charts for comparing two conditions."""
    fig = make_subplots(
        rows=1, cols=2,
        specs=[[{"type": "polar"}, {"type": "polar"}]],
        subplot_titles=[label_a, label_b],
    )

    width = 360 / TOTAL_POCKETS - 0.5

    for i, (df, label) in enumerate([(freq_a, label_a), (freq_b, label_b)], 1):
        if df.empty:
            continue
        df = df.sort_values("wheel_position")
        angles = [NUMBER_TO_ANGLE[n] for n in df["number"]]

        fig.add_trace(go.Barpolar(
            r=df["count"].values,
            theta=angles,
            width=[width] * len(df),
            marker=dict(color="#e63946" if i == 1 else "#457b9d"),
            text=[f"{n}: {c}" for n, c in zip(df["number"], df["count"])],
            hoverinfo="text",
            name=label,
        ), row=1, col=i)

    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=400,
        font=dict(color="white"),
        showlegend=False,
        margin=dict(t=60, b=20),
    )

    for i in range(1, 3):
        key = f"polar{i if i > 1 else ''}"
        fig.update_layout(**{
            key: dict(
                angularaxis=dict(
                    tickvals=[NUMBER_TO_ANGLE[n] for n in WHEEL_ORDER],
                    ticktext=[str(n) for n in WHEEL_ORDER],
                    direction="clockwise",
                    rotation=90,
                    tickfont=dict(size=7),
                ),
                radialaxis=dict(tickfont=dict(size=7)),
                bgcolor="rgba(0,0,0,0)",
            )
        })

    return fig


def spin_timeline(spins_df: pd.DataFrame, title: str = "Spin Timeline") -> go.Figure:
    """Line chart of results over time, y-axis sorted by wheel position."""
    if spins_df.empty:
        fig = go.Figure()
        fig.add_annotation(text="No data", showarrow=False, font=dict(size=20))
        return fig

    # Sort by recorded_at ascending
    df = spins_df.sort_values("recorded_at").reset_index(drop=True)
    wheel_positions = [NUMBER_TO_POSITION[n] for n in df["result_number"]]

    colors = [
        {"red": "#e63946", "black": "#8d99ae", "green": "#2a9d8f"}[number_color(n)]
        for n in df["result_number"]
    ]

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=list(range(len(df))),
        y=wheel_positions,
        mode="markers+lines",
        marker=dict(color=colors, size=8),
        line=dict(color="rgba(255,255,255,0.2)", width=1),
        text=[f"Spin {i+1}: {n}" for i, n in enumerate(df["result_number"])],
        hoverinfo="text",
    ))

    # Add y-axis tick labels as wheel numbers
    tick_positions = list(range(TOTAL_POCKETS))
    tick_labels = [str(WHEEL_ORDER[i]) for i in tick_positions]

    fig.update_layout(
        title=title,
        xaxis_title="Spin #",
        yaxis=dict(
            title="Wheel Position",
            tickvals=tick_positions[::3],
            ticktext=tick_labels[::3],
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=350,
        font=dict(color="white"),
        margin=dict(t=60, b=40),
    )

    return fig


def prediction_display(ranked_numbers: list, sector_rankings: list,
                       confidence: str, sample_size: int) -> go.Figure:
    """Create a visual display of prediction results as a polar chart."""
    if not ranked_numbers:
        fig = go.Figure()
        fig.add_annotation(text="No predictions", showarrow=False, font=dict(size=20))
        return fig

    # Show probability distribution on the wheel
    probs = {n: p for n, p, _ in ranked_numbers}
    fair_prob = 1 / TOTAL_POCKETS

    angles = []
    values = []
    colors = []
    texts = []

    for num in WHEEL_ORDER:
        prob = probs.get(num, fair_prob)
        angles.append(NUMBER_TO_ANGLE[num])
        values.append(prob * 100)

        advantage = (prob - fair_prob) / fair_prob * 100
        if advantage > 20:
            colors.append("#e63946")
        elif advantage > 10:
            colors.append("#f4a261")
        elif advantage > 0:
            colors.append("#e9c46a")
        else:
            colors.append("#457b9d")

        texts.append(f"<b>{num}</b><br>Prob: {prob*100:.2f}%<br>Adv: {advantage:+.1f}%")

    width = 360 / TOTAL_POCKETS - 0.5

    fig = go.Figure()

    fig.add_trace(go.Barpolar(
        r=values,
        theta=angles,
        width=[width] * len(values),
        marker=dict(color=colors, line=dict(color="rgba(255,255,255,0.3)", width=1)),
        text=texts,
        hoverinfo="text",
    ))

    # Fair probability line
    fair_ring = np.linspace(0, 360, 100)
    fig.add_trace(go.Scatterpolar(
        r=[fair_prob * 100] * 100,
        theta=fair_ring,
        mode="lines",
        line=dict(color="rgba(255,255,255,0.5)", width=1, dash="dash"),
        hoverinfo="skip",
        showlegend=False,
    ))

    fig.update_layout(
        title=f"Predicted Distribution (n={sample_size})",
        polar=dict(
            angularaxis=dict(
                tickvals=[NUMBER_TO_ANGLE[n] for n in WHEEL_ORDER],
                ticktext=[str(n) for n in WHEEL_ORDER],
                direction="clockwise",
                rotation=90,
                tickfont=dict(size=9),
            ),
            radialaxis=dict(
                ticksuffix="%",
                tickfont=dict(size=8),
            ),
            bgcolor="rgba(0,0,0,0)",
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=500,
        margin=dict(t=60, b=20, l=20, r=20),
        font=dict(color="white"),
    )

    return fig
