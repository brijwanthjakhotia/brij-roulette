"""Data Management — dealer CRUD, CSV import/export, backup/restore."""

import streamlit as st
from src.database import (
    get_dealers, update_dealer, delete_dealer, delete_all_spins,
    get_spin_count, clear_all_data, get_total_stats,
)
from src.csv_handler import validate_csv, import_csv, export_csv
from src.persistence import export_all, import_all

st.header("Data Management")

tab_dealers, tab_import, tab_export, tab_backup = st.tabs(
    ["Dealers", "CSV Import", "CSV Export", "Backup & Restore"]
)

# --- Dealer CRUD ---
with tab_dealers:
    dealers = get_dealers()
    if not dealers:
        st.info("No dealers yet.")
    else:
        for dealer in dealers:
            with st.expander(f"{dealer['name']} ({dealer['spin_count']} spins)"):
                with st.form(f"edit_dealer_{dealer['id']}"):
                    new_name = st.text_input("Name", value=dealer["name"])
                    new_notes = st.text_area("Notes", value=dealer["notes"] or "")
                    c1, c2 = st.columns(2)
                    save = c1.form_submit_button("Save Changes")
                    if save:
                        try:
                            update_dealer(dealer["id"], new_name, new_notes)
                            st.success("Updated!")
                            st.rerun()
                        except Exception as e:
                            st.error(str(e))

                # Delete buttons outside the form
                c1, c2 = st.columns(2)
                if c1.button(f"Delete all spins", key=f"del_spins_{dealer['id']}"):
                    delete_all_spins(dealer["id"])
                    st.success("All spins deleted.")
                    st.rerun()
                if c2.button(f"Delete dealer", key=f"del_dealer_{dealer['id']}", type="primary"):
                    delete_dealer(dealer["id"])
                    st.success(f"Dealer '{dealer['name']}' deleted.")
                    st.rerun()

# --- CSV Import ---
with tab_import:
    st.subheader("Import Spins from CSV")
    st.caption("Required columns: `dealer_name`, `result_number`")
    st.caption("Optional columns: `ball_size`, `spin_speed`, `wheel_speed`, `ball_direction`, `session_tag`, `notes`, `recorded_at`")

    uploaded = st.file_uploader("Upload CSV", type=["csv"], key="csv_import")
    if uploaded is not None:
        is_valid, errors, preview = validate_csv(uploaded)

        if preview is not None:
            st.write("**Preview (first 10 rows):**")
            st.dataframe(preview, use_container_width=True)

        if errors:
            for err in errors:
                st.error(err)

        if is_valid:
            st.success("CSV is valid!")
            if st.button("Import Data", type="primary"):
                uploaded.seek(0)  # Reset file pointer
                n_imported, n_skipped, import_errors = import_csv(uploaded)
                st.success(f"Imported {n_imported} spins, skipped {n_skipped}.")
                if import_errors:
                    with st.expander("Import warnings"):
                        for err in import_errors:
                            st.warning(err)
                st.rerun()

# --- CSV Export ---
with tab_export:
    st.subheader("Export Spins to CSV")
    dealers = get_dealers()

    export_option = st.radio("Export scope", ["All dealers", "Specific dealer"])

    dealer_id = None
    if export_option == "Specific dealer" and dealers:
        dealer_names = {d["name"]: d["id"] for d in dealers}
        selected = st.selectbox("Select dealer", list(dealer_names.keys()), key="export_dealer")
        dealer_id = dealer_names[selected]

    count = get_spin_count(dealer_id, {}) if dealer_id else get_total_stats()["spin_count"]
    st.caption(f"{count} spins will be exported")

    if count > 0:
        csv_data = export_csv(dealer_id)
        st.download_button(
            "Download CSV",
            data=csv_data,
            file_name="roulette_spins.csv",
            mime="text/csv",
            use_container_width=True,
        )
    else:
        st.info("No spins to export.")

# --- Backup & Restore ---
with tab_backup:
    st.subheader("Full Backup")
    stats = get_total_stats()
    if stats["spin_count"] > 0:
        backup_json = export_all()
        st.download_button(
            "Download Full Backup (JSON)",
            data=backup_json,
            file_name="roulette_backup.json",
            mime="application/json",
            use_container_width=True,
        )
    else:
        st.info("No data to backup.")

    st.divider()

    st.subheader("Restore from Backup")
    restore_file = st.file_uploader("Upload backup JSON", type=["json"], key="restore_backup")
    if restore_file is not None:
        st.warning("This will **replace all existing data** with the backup contents.")
        if st.button("Confirm Restore", type="primary"):
            try:
                import_all(restore_file.read().decode("utf-8"))
                st.success("Data restored successfully!")
                st.rerun()
            except Exception as e:
                st.error(f"Restore failed: {e}")

    st.divider()

    st.subheader("Danger Zone")
    st.warning("This will permanently delete ALL data.")
    if st.button("Clear All Data", type="primary"):
        if "confirm_clear" not in st.session_state:
            st.session_state.confirm_clear = True
            st.rerun()

    if st.session_state.get("confirm_clear"):
        st.error("Are you sure? This cannot be undone.")
        c1, c2 = st.columns(2)
        if c1.button("Yes, delete everything"):
            clear_all_data()
            st.session_state.confirm_clear = False
            st.success("All data cleared.")
            st.rerun()
        if c2.button("Cancel"):
            st.session_state.confirm_clear = False
            st.rerun()
