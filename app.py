"""Roulette Dealer Signature Tracker — Streamlit entrypoint."""

import streamlit as st

st.set_page_config(
    page_title="Roulette Dealer Tracker",
    page_icon="\U0001f3b0",
    layout="wide",
    initial_sidebar_state="expanded",
)

from src.database import get_connection, get_total_stats
from src.persistence import export_all, import_all

# Initialize database
get_connection()

# --- Sidebar: global info + backup/restore ---
with st.sidebar:
    st.title("Dealer Tracker")
    stats = get_total_stats()
    st.caption(f"{stats['dealer_count']} dealers \u00b7 {stats['spin_count']} total spins")

    st.divider()

    # Backup download
    if stats["spin_count"] > 0:
        backup_json = export_all()
        st.download_button(
            label="Download Backup",
            data=backup_json,
            file_name="roulette_backup.json",
            mime="application/json",
            use_container_width=True,
        )

    # Restore upload
    uploaded = st.file_uploader("Restore from backup", type=["json"], key="sidebar_restore")
    if uploaded is not None:
        if st.button("Confirm Restore", type="primary", use_container_width=True):
            try:
                import_all(uploaded.read().decode("utf-8"))
                st.success("Data restored successfully!")
                st.rerun()
            except Exception as e:
                st.error(f"Restore failed: {e}")

# --- Navigation ---
dashboard = st.Page("pages/1_Dashboard.py", title="Dashboard", icon="\U0001f4ca", default=True)
spin_logger = st.Page("pages/2_Spin_Logger.py", title="Spin Logger", icon="\U0001f3b2")
analysis = st.Page("pages/3_Analysis.py", title="Analysis", icon="\U0001f50d")
predictions = st.Page("pages/4_Predictions.py", title="Predictions", icon="\U0001f3af")
data_mgmt = st.Page("pages/5_Data_Management.py", title="Data Management", icon="\U0001f4be")

pg = st.navigation([dashboard, spin_logger, analysis, predictions, data_mgmt])
pg.run()
