"""Dashboard — dealer overview and quick stats."""

import streamlit as st
from src.database import get_dealers, get_total_stats, add_dealer, get_spins
from src.statistics import chi_squared_test, confidence_level, confidence_badge

st.header("Dashboard")

stats = get_total_stats()
col1, col2 = st.columns(2)
col1.metric("Total Dealers", stats["dealer_count"])
col2.metric("Total Spins", stats["spin_count"])

st.divider()

# --- Dealer list ---
dealers = get_dealers()

if not dealers:
    st.info("No dealers yet. Add your first dealer below to get started.")
else:
    st.subheader("Dealers")
    for dealer in dealers:
        with st.container(border=True):
            c1, c2, c3 = st.columns([3, 1, 1])
            c1.markdown(f"**{dealer['name']}**")
            if dealer["notes"]:
                c1.caption(dealer["notes"])
            c2.metric("Spins", dealer["spin_count"])

            # Signature strength indicator
            if dealer["spin_count"] > 0:
                spins_df = get_spins(dealer["id"])
                chi2 = chi_squared_test(spins_df)
                conf = confidence_level(chi2["sample_size"], chi2["p_value"])
                c3.markdown(f"**Signature**\n\n{confidence_badge(conf)}")
            else:
                c3.caption("No data")

st.divider()

# --- Quick add dealer ---
st.subheader("Add New Dealer")
with st.form("add_dealer_form", clear_on_submit=True):
    name = st.text_input("Dealer Name")
    notes = st.text_area("Notes (optional)", height=68)
    submitted = st.form_submit_button("Add Dealer", use_container_width=True)

    if submitted:
        if not name.strip():
            st.error("Dealer name is required.")
        else:
            try:
                add_dealer(name, notes)
                st.success(f"Dealer '{name}' added!")
                st.rerun()
            except Exception as e:
                if "UNIQUE" in str(e):
                    st.error(f"Dealer '{name}' already exists.")
                else:
                    st.error(f"Error: {e}")
