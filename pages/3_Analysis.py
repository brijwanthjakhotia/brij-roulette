"""Analysis — full statistical analysis with filters and visualizations."""

import streamlit as st
from src.database import get_dealers, get_spins, get_spin_count
from src.statistics import (
    frequency_distribution, chi_squared_test, sector_frequencies,
    sector_chi_squared, conditional_analysis, confidence_level, confidence_badge,
)
from src.visualization import wheel_heatmap, sector_donut, frequency_bar, spin_timeline, comparison_polar
from src.models import BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, BALL_DIRECTIONS

st.header("Analysis")

dealers = get_dealers()
if not dealers:
    st.warning("No dealers found. Add a dealer from the Dashboard first.")
    st.stop()

# --- Dealer selector ---
dealer_names = {d["name"]: d["id"] for d in dealers}
selected_name = st.selectbox("Select Dealer", list(dealer_names.keys()))
dealer_id = dealer_names[selected_name]

# --- Filters ---
with st.expander("Filter by conditions", expanded=False):
    fc1, fc2, fc3, fc4 = st.columns(4)
    ball_size_filter = fc1.selectbox("Ball Size", ["All"] + BALL_SIZES, key="f_bs")
    spin_speed_filter = fc2.selectbox("Spin Speed", ["All"] + SPIN_SPEEDS, key="f_ss")
    wheel_speed_filter = fc3.selectbox("Wheel Speed", ["All"] + WHEEL_SPEEDS, key="f_ws")
    ball_dir_filter = fc4.selectbox(
        "Ball Direction", ["All", "cw", "ccw"], key="f_bd",
        format_func=lambda x: {"All": "All", "cw": "Clockwise", "ccw": "Counter-CW"}.get(x, x)
    )

filters = {
    "ball_size": ball_size_filter if ball_size_filter != "All" else None,
    "spin_speed": spin_speed_filter if spin_speed_filter != "All" else None,
    "wheel_speed": wheel_speed_filter if wheel_speed_filter != "All" else None,
    "ball_direction": ball_dir_filter if ball_dir_filter != "All" else None,
}
active_filters = {k: v for k, v in filters.items() if v is not None}

# Get filtered spins
spins_df = get_spins(dealer_id, active_filters if active_filters else None)

if spins_df.empty:
    st.info("No spins match the current filters.")
    st.stop()

# --- Metrics row ---
chi2_result = chi_squared_test(spins_df)
conf = confidence_level(chi2_result["sample_size"], chi2_result["p_value"])

m1, m2, m3, m4 = st.columns(4)
m1.metric("Spins", chi2_result["sample_size"])
m2.metric("Chi-squared", f"{chi2_result['chi2']:.1f}")
m3.metric("p-value", f"{chi2_result['p_value']:.4f}")
m4.markdown(f"**Confidence**\n\n{confidence_badge(conf)}")

if chi2_result["sample_size"] < 185:
    st.caption(
        f"Note: {chi2_result['sample_size']} spins recorded. "
        "At least 185 spins recommended for reliable per-number analysis."
    )

st.divider()

# --- Visualizations ---
freq_df = frequency_distribution(spins_df)
sect_df = sector_frequencies(spins_df)

# Wheel heatmap + sector donut side by side
col1, col2 = st.columns([3, 2])
with col1:
    st.plotly_chart(wheel_heatmap(freq_df), use_container_width=True)
with col2:
    st.plotly_chart(sector_donut(sect_df), use_container_width=True)

    # Sector details
    sect_chi = sector_chi_squared(spins_df)
    st.caption(f"Sector chi-squared: {sect_chi['chi2']:.1f} (p={sect_chi['p_value']:.4f})")

# Number frequency bar chart
st.plotly_chart(frequency_bar(freq_df), use_container_width=True)

# --- Top numbers table ---
st.subheader("Top Numbers")
top_nums = freq_df.nlargest(10, "count")[["number", "count", "expected", "deviation_pct", "probability"]]
top_nums.columns = ["Number", "Count", "Expected", "Deviation %", "Probability"]
st.dataframe(top_nums, use_container_width=True, hide_index=True)

st.divider()

# --- Conditional comparison ---
st.subheader("Conditional Comparison")
condition_col = st.selectbox(
    "Compare by",
    ["ball_size", "spin_speed", "wheel_speed", "ball_direction"],
    format_func=lambda x: x.replace("_", " ").title()
)

# Use unfiltered data for conditional comparison
all_spins = get_spins(dealer_id)
cond_results = conditional_analysis(all_spins, condition_col)

if len(cond_results) < 2:
    st.info(f"Need at least 2 different values for '{condition_col.replace('_', ' ')}' to compare.")
else:
    keys = list(cond_results.keys())
    cc1, cc2 = st.columns(2)
    val_a = cc1.selectbox("Condition A", keys, index=0)
    val_b = cc2.selectbox("Condition B", keys, index=min(1, len(keys) - 1))

    if val_a != val_b:
        fig = comparison_polar(cond_results[val_a], cond_results[val_b], val_a, val_b)
        st.plotly_chart(fig, use_container_width=True)

        # Show counts
        cc1.caption(f"{val_a}: {len(cond_results[val_a])} data points")
        cc2.caption(f"{val_b}: {len(cond_results[val_b])} data points")

st.divider()

# --- Spin timeline ---
st.subheader("Spin Timeline")
st.plotly_chart(spin_timeline(spins_df), use_container_width=True)
