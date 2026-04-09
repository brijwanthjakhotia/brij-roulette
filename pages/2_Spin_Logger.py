"""Spin Logger — manual spin entry and recent history."""

import streamlit as st
from src.database import get_dealers, add_spin, get_recent_spins, delete_spin
from src.models import BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, BALL_DIRECTIONS
from src.wheel import number_color

st.header("Spin Logger")

dealers = get_dealers()
if not dealers:
    st.warning("No dealers found. Add a dealer from the Dashboard first.")
    st.stop()

# Dealer selector
dealer_names = {d["name"]: d["id"] for d in dealers}
selected_name = st.selectbox("Select Dealer", list(dealer_names.keys()))
dealer_id = dealer_names[selected_name]

st.divider()

# --- Spin entry form ---
st.subheader("Log a Spin")

with st.form("spin_form", clear_on_submit=True):
    col1, col2 = st.columns(2)

    with col1:
        result_number = st.number_input(
            "Result Number", min_value=0, max_value=36, step=1, value=0
        )
        ball_size = st.selectbox("Ball Size", ["Unknown"] + BALL_SIZES)
        spin_speed = st.selectbox("Spin Speed", ["Unknown"] + SPIN_SPEEDS)

    with col2:
        wheel_speed = st.selectbox("Wheel Speed", ["Unknown"] + WHEEL_SPEEDS)
        ball_direction = st.selectbox(
            "Ball Direction",
            ["Unknown", "cw", "ccw"],
            format_func=lambda x: {"Unknown": "Unknown", "cw": "Clockwise", "ccw": "Counter-Clockwise"}[x]
        )
        session_tag = st.text_input("Session Tag (optional)")

    notes = st.text_input("Notes (optional)")
    submitted = st.form_submit_button("Log Spin", use_container_width=True, type="primary")

    if submitted:
        add_spin(
            dealer_id=dealer_id,
            result_number=result_number,
            ball_size=ball_size if ball_size != "Unknown" else None,
            spin_speed=spin_speed if spin_speed != "Unknown" else None,
            wheel_speed=wheel_speed if wheel_speed != "Unknown" else None,
            ball_direction=ball_direction if ball_direction != "Unknown" else None,
            session_tag=session_tag,
            notes=notes,
        )
        st.success(f"Logged: **{result_number}** ({number_color(result_number)})")
        st.rerun()

st.divider()

# --- Quick number grid ---
st.subheader("Quick Log (tap a number)")
st.caption("Logs with current form settings for ball/speed/direction")

# Render a grid of 0-36
cols_per_row = 10
for row_start in range(0, 37, cols_per_row):
    cols = st.columns(min(cols_per_row, 37 - row_start))
    for i, col in enumerate(cols):
        num = row_start + i
        if num > 36:
            break
        color = number_color(num)
        label = f"{'🟢' if color == 'green' else '🔴' if color == 'red' else '⚫'} {num}"
        if col.button(label, key=f"quick_{num}", use_container_width=True):
            add_spin(dealer_id=dealer_id, result_number=num)
            st.toast(f"Logged: {num}")
            st.rerun()

st.divider()

# --- Recent spins ---
st.subheader("Recent Spins")
recent = get_recent_spins(dealer_id, limit=20)

if recent.empty:
    st.info("No spins recorded yet for this dealer.")
else:
    for _, spin in recent.iterrows():
        num = int(spin["result_number"])
        color = number_color(num)
        icon = "🟢" if color == "green" else "🔴" if color == "red" else "⚫"

        col1, col2, col3 = st.columns([1, 4, 1])
        col1.markdown(f"### {icon} {num}")

        details = []
        if spin["ball_size"]:
            details.append(f"Ball: {spin['ball_size']}")
        if spin["spin_speed"]:
            details.append(f"Spin: {spin['spin_speed']}")
        if spin["wheel_speed"]:
            details.append(f"Wheel: {spin['wheel_speed']}")
        if spin["ball_direction"]:
            details.append(f"Dir: {'CW' if spin['ball_direction'] == 'cw' else 'CCW'}")
        col2.caption(" · ".join(details) if details else "No parameters recorded")

        if col3.button("Delete", key=f"del_{spin['id']}"):
            delete_spin(int(spin["id"]))
            st.rerun()
