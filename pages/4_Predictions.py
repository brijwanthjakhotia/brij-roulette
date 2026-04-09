"""Predictions — dealer signature-based number and sector predictions."""

import streamlit as st
from src.database import get_dealers, get_spins, get_spin_count
from src.prediction import predict
from src.statistics import confidence_badge
from src.visualization import prediction_display
from src.models import BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, BALL_DIRECTIONS
from src.wheel import SECTORS

st.header("Predictions")

dealers = get_dealers()
if not dealers:
    st.warning("No dealers found. Add a dealer from the Dashboard first.")
    st.stop()

# --- Dealer selector ---
dealer_names = {d["name"]: d["id"] for d in dealers}
selected_name = st.selectbox("Select Dealer", list(dealer_names.keys()))
dealer_id = dealer_names[selected_name]

total_spins = get_spin_count(dealer_id)
st.caption(f"{total_spins} total spins recorded for this dealer")

if total_spins == 0:
    st.info("Log some spins first to generate predictions.")
    st.stop()

st.divider()

# --- Current conditions ---
st.subheader("Current Conditions")
st.caption("Select the current table conditions to get tailored predictions")

c1, c2, c3, c4 = st.columns(4)
ball_size = c1.selectbox("Ball Size", ["Any"] + BALL_SIZES)
spin_speed = c2.selectbox("Spin Speed", ["Any"] + SPIN_SPEEDS)
wheel_speed = c3.selectbox("Wheel Speed", ["Any"] + WHEEL_SPEEDS)
ball_direction = c4.selectbox(
    "Ball Direction", ["Any", "cw", "ccw"],
    format_func=lambda x: {"Any": "Any", "cw": "Clockwise", "ccw": "Counter-CW"}.get(x, x)
)

# Advanced settings
with st.expander("Advanced Settings"):
    top_n = st.slider("Top N numbers", min_value=3, max_value=15, value=5)
    kernel_sigma = st.slider("Kernel smoothing (sigma)", min_value=0.5, max_value=5.0, value=2.0, step=0.5)
    st.caption("Higher sigma = more smoothing (broader zones). Lower = sharper focus on exact hits.")

# Build filters
filters = {
    "ball_size": ball_size if ball_size != "Any" else None,
    "spin_speed": spin_speed if spin_speed != "Any" else None,
    "wheel_speed": wheel_speed if wheel_speed != "Any" else None,
    "ball_direction": ball_direction if ball_direction != "Any" else None,
}
active_filters = {k: v for k, v in filters.items() if v is not None}

# --- Generate predictions ---
if st.button("Generate Prediction", type="primary", use_container_width=True):
    # Get filtered spins
    filtered_spins = get_spins(dealer_id, active_filters if active_filters else None)
    used_fallback = False

    # Fallback to all spins if filtered set is too small
    if len(filtered_spins) < 30 and active_filters:
        st.warning(
            f"Only {len(filtered_spins)} spins match these conditions. "
            f"Falling back to all {total_spins} spins for this dealer."
        )
        filtered_spins = get_spins(dealer_id)
        used_fallback = True

    result = predict(filtered_spins, top_n=top_n, kernel_sigma=kernel_sigma)

    st.divider()

    # --- Results ---
    st.subheader("Prediction Results")

    # Confidence + sample info
    r1, r2, r3 = st.columns(3)
    r1.markdown(f"**Confidence:** {confidence_badge(result.confidence)}")
    r2.metric("Sample Size", result.sample_size)
    r3.metric("p-value", f"{result.p_value:.4f}")

    if used_fallback:
        st.caption("Using all dealer spins (conditions filter had too few matches)")

    st.divider()

    # Top numbers
    col1, col2 = st.columns([2, 3])

    with col1:
        st.subheader(f"Top {top_n} Numbers")
        for rank, (num, prob, advantage) in enumerate(result.ranked_numbers, 1):
            adv_color = "green" if advantage > 0 else "red"
            st.markdown(
                f"**#{rank}** — Number **{num}** "
                f"({prob*100:.2f}%, :{adv_color}[{advantage:+.1f}%])"
            )

        st.divider()

        st.subheader("Hot Sectors")
        for sector_name, sector_prob in result.sector_rankings:
            expected_prob = len(SECTORS[sector_name]) / 37
            advantage = (sector_prob - expected_prob) / expected_prob * 100
            bar_val = min(sector_prob / max(s[1] for s in result.sector_rankings), 1.0)
            st.markdown(
                f"**Sector {sector_name}** — {SECTORS[sector_name]}"
            )
            st.progress(bar_val, text=f"{sector_prob*100:.1f}% ({advantage:+.1f}%)")

    with col2:
        fig = prediction_display(
            result.ranked_numbers if len(result.ranked_numbers) == top_n else result.ranked_numbers,
            result.sector_rankings,
            result.confidence,
            result.sample_size,
        )
        # For the wheel chart, pass all numbers not just top N
        all_result = predict(filtered_spins, top_n=37, kernel_sigma=kernel_sigma)
        fig = prediction_display(
            all_result.ranked_numbers,
            all_result.sector_rankings,
            all_result.confidence,
            all_result.sample_size,
        )
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    st.caption(
        "These predictions are based on statistical patterns in recorded dealer spins. "
        "Roulette outcomes are influenced by many factors and cannot be guaranteed. "
        "Use responsibly."
    )
