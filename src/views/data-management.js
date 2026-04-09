import { getDealers, updateDealer, deleteDealer, clearAllData, getTotalStats } from '../db/dealers.js';
import { deleteAllSpins, getSpinCount } from '../db/spins.js';
import { validateCSV, importCSV, exportCSV } from '../data/csv-handler.js';
import { exportAll, importAll } from '../data/persistence.js';
import { isConfigured } from '../sync/firebase-config.js';
import { getSyncStatus, signInAnonymously, signInWithGoogle, signOut, pushToCloud, pullFromCloud, getLastSyncTime } from '../sync/firestore-sync.js';
import { el, createTabs, selectInput, formGroup, showModal } from '../ui/components.js';
import { showToast } from '../ui/notifications.js';

function download(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function renderDataManagement(container) {
  container.innerHTML = '';
  container.appendChild(el('h2', { textContent: 'Data Management' }));

  const tabs = createTabs([
    { label: 'Dealers', render: renderDealersTab },
    { label: 'CSV Import', render: renderImportTab },
    { label: 'CSV Export', render: renderExportTab },
    { label: 'Backup', render: renderBackupTab },
    { label: 'Cloud Sync', render: renderSyncTab },
  ]);
  container.appendChild(tabs);

  // === Dealers Tab ===
  async function renderDealersTab(tab) {
    tab.innerHTML = '';
    const dealers = await getDealers();

    if (dealers.length === 0) {
      tab.appendChild(el('p', { className: 'text-muted', textContent: 'No dealers yet.' }));
      return;
    }

    for (const dealer of dealers) {
      const card = el('div', { className: 'card' });
      card.appendChild(el('h3', { textContent: `${dealer.name} (${dealer.spinCount} spins)` }));

      const nameInput = el('input', { type: 'text', value: dealer.name });
      const notesInput = el('textarea', { value: dealer.notes || '', rows: '2' });

      card.append(
        formGroup('Name', nameInput),
        formGroup('Notes', notesInput),
      );

      const btnRow = el('div', { style: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' } });
      btnRow.appendChild(el('button', {
        className: 'btn btn-secondary',
        textContent: 'Save Changes',
        onClick: async () => {
          try {
            await updateDealer(dealer.id, nameInput.value, notesInput.value);
            showToast('Updated!', 'success');
          } catch (e) { showToast(e.message, 'error'); }
        },
      }));
      btnRow.appendChild(el('button', {
        className: 'btn btn-danger btn-sm',
        textContent: 'Delete Spins',
        onClick: () => showModal('Delete Spins', `Delete all spins for ${dealer.name}?`, async () => {
          await deleteAllSpins(dealer.id);
          showToast('Spins deleted', 'success');
          renderDealersTab(tab);
        }),
      }));
      btnRow.appendChild(el('button', {
        className: 'btn btn-danger btn-sm',
        textContent: 'Delete Dealer',
        onClick: () => showModal('Delete Dealer', `Delete ${dealer.name} and all their spins?`, async () => {
          await deleteDealer(dealer.id);
          showToast('Dealer deleted', 'success');
          renderDealersTab(tab);
        }),
      }));

      card.appendChild(btnRow);
      tab.appendChild(card);
    }
  }

  // === CSV Import Tab ===
  function renderImportTab(tab) {
    tab.innerHTML = '';
    tab.appendChild(el('h3', { textContent: 'Import Spins from CSV' }));
    tab.appendChild(el('p', { className: 'text-muted', textContent: 'Required: dealer_name, result_number. Optional: ball_size, spin_speed, wheel_speed, ball_direction, session_tag, notes, recorded_at' }));

    const fileInput = el('input', { type: 'file', accept: '.csv' });
    const previewArea = el('div');

    fileInput.addEventListener('change', async () => {
      previewArea.innerHTML = '';
      const file = fileInput.files[0];
      if (!file) return;

      const text = await file.text();
      const { valid, errors, preview } = validateCSV(text);

      if (preview && preview.length > 0) {
        previewArea.appendChild(el('h3', { textContent: 'Preview (first 10 rows)' }));
        const headers = Object.keys(preview[0]);
        const table = el('table');
        table.appendChild(el('thead', {}, [el('tr', {}, headers.map(h => el('th', { textContent: h })))]));
        const tbody = el('tbody', {}, preview.map(row => el('tr', {}, headers.map(h => el('td', { textContent: row[h] || '' })))));
        table.appendChild(tbody);
        previewArea.appendChild(table);
      }

      for (const err of errors) {
        previewArea.appendChild(el('p', { className: 'text-danger', textContent: err }));
      }

      if (valid) {
        previewArea.appendChild(el('p', { className: 'text-success', textContent: 'CSV is valid!' }));
        previewArea.appendChild(el('button', {
          className: 'btn btn-primary',
          textContent: 'Import Data',
          onClick: async () => {
            const result = await importCSV(text);
            showToast(`Imported ${result.imported} spins, skipped ${result.skipped}`, 'success');
          },
        }));
      }
    });

    tab.appendChild(formGroup('Upload CSV', fileInput));
    tab.appendChild(previewArea);
  }

  // === CSV Export Tab ===
  async function renderExportTab(tab) {
    tab.innerHTML = '';
    tab.appendChild(el('h3', { textContent: 'Export Spins to CSV' }));

    const dealers = await getDealers();
    let exportDealerId = null;

    const scopeSelect = selectInput(
      [{ value: '', label: 'All dealers' }, ...dealers.map(d => ({ value: d.id, label: d.name }))],
      '', (v) => { exportDealerId = v ? Number(v) : null; }
    );
    tab.appendChild(formGroup('Export scope', scopeSelect));

    tab.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Download CSV',
      onClick: async () => {
        const csv = await exportCSV(exportDealerId);
        download('roulette_spins.csv', csv, 'text/csv');
        showToast('CSV exported', 'success');
      },
    }));
  }

  // === Backup Tab ===
  async function renderBackupTab(tab) {
    tab.innerHTML = '';
    const stats = await getTotalStats();

    tab.appendChild(el('h3', { textContent: 'Full Backup (JSON)' }));
    if (stats.spinCount > 0) {
      tab.appendChild(el('button', {
        className: 'btn btn-primary',
        textContent: 'Download Backup',
        onClick: async () => {
          const json = await exportAll();
          download('roulette_backup.json', json, 'application/json');
          showToast('Backup downloaded', 'success');
        },
      }));
    } else {
      tab.appendChild(el('p', { className: 'text-muted', textContent: 'No data to backup.' }));
    }

    tab.appendChild(el('hr', { className: 'divider' }));
    tab.appendChild(el('h3', { textContent: 'Restore from Backup' }));

    const restoreInput = el('input', { type: 'file', accept: '.json' });
    restoreInput.addEventListener('change', async () => {
      const file = restoreInput.files[0];
      if (!file) return;
      showModal('Restore Backup', 'This will REPLACE all existing data with the backup contents.', async () => {
        try {
          const text = await file.text();
          await importAll(text);
          showToast('Data restored!', 'success');
          renderBackupTab(tab);
        } catch (e) { showToast(`Restore failed: ${e.message}`, 'error'); }
      });
    });
    tab.appendChild(formGroup('Upload backup JSON', restoreInput));

    tab.appendChild(el('hr', { className: 'divider' }));
    tab.appendChild(el('h3', { className: 'text-danger', textContent: 'Danger Zone' }));
    tab.appendChild(el('button', {
      className: 'btn btn-danger',
      textContent: 'Clear All Data',
      onClick: () => showModal('Clear All Data', 'This will permanently delete ALL data. This cannot be undone.', async () => {
        await clearAllData();
        showToast('All data cleared', 'success');
        renderBackupTab(tab);
      }),
    }));
  }

  // === Cloud Sync Tab ===
  async function renderSyncTab(tab) {
    tab.innerHTML = '';
    tab.appendChild(el('h3', { textContent: 'Cloud Sync (Firebase)' }));

    if (!isConfigured()) {
      tab.appendChild(el('div', { className: 'card' }, [
        el('p', { textContent: 'Firebase is not configured yet.' }),
        el('p', { className: 'text-muted', textContent: 'To enable cloud sync, edit src/sync/firebase-config.js with your Firebase project config from console.firebase.google.com.' }),
        el('p', { className: 'text-muted', innerHTML: 'Steps: 1) Create a Firebase project 2) Enable Firestore + Authentication (Anonymous + Google) 3) Copy the config object into firebase-config.js 4) Deploy Firestore security rules' }),
      ]));
      return;
    }

    const status = getSyncStatus();
    const syncTimes = await getLastSyncTime();

    if (!status.signedIn) {
      tab.appendChild(el('p', { className: 'text-muted', textContent: 'Sign in to sync your data to the cloud.' }));
      const btnRow = el('div', { style: { display: 'flex', gap: '0.75rem', marginTop: '1rem' } });
      btnRow.appendChild(el('button', {
        className: 'btn btn-primary',
        textContent: 'Sign in Anonymously',
        onClick: async () => {
          try {
            await signInAnonymously();
            showToast('Signed in anonymously', 'success');
            renderSyncTab(tab);
          } catch (e) { showToast(`Sign-in failed: ${e.message}`, 'error'); }
        },
      }));
      btnRow.appendChild(el('button', {
        className: 'btn btn-secondary',
        textContent: 'Sign in with Google',
        onClick: async () => {
          try {
            await signInWithGoogle();
            showToast('Signed in with Google', 'success');
            renderSyncTab(tab);
          } catch (e) { showToast(`Sign-in failed: ${e.message}`, 'error'); }
        },
      }));
      tab.appendChild(btnRow);
    } else {
      tab.appendChild(el('div', { className: 'card' }, [
        el('p', { innerHTML: `<strong>Signed in:</strong> ${status.displayName || 'Anonymous'}` }),
        el('p', { className: 'text-muted', textContent: `User ID: ${status.userId}` }),
      ]));

      if (syncTimes.lastPush) {
        tab.appendChild(el('p', { className: 'text-muted', textContent: `Last push: ${new Date(syncTimes.lastPush).toLocaleString()}` }));
      }
      if (syncTimes.lastPull) {
        tab.appendChild(el('p', { className: 'text-muted', textContent: `Last pull: ${new Date(syncTimes.lastPull).toLocaleString()}` }));
      }

      const btnRow = el('div', { style: { display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' } });
      btnRow.appendChild(el('button', {
        className: 'btn btn-success',
        textContent: 'Push to Cloud',
        onClick: async () => {
          try {
            const result = await pushToCloud();
            showToast(`Pushed ${result.dealers} dealers + ${result.spins} spins`, 'success');
            renderSyncTab(tab);
          } catch (e) { showToast(`Push failed: ${e.message}`, 'error'); }
        },
      }));
      btnRow.appendChild(el('button', {
        className: 'btn btn-secondary',
        textContent: 'Pull from Cloud',
        onClick: () => showModal('Pull from Cloud', 'This will REPLACE your local data with the cloud version.', async () => {
          try {
            const result = await pullFromCloud();
            showToast(`Pulled ${result.dealers} dealers + ${result.spins} spins`, 'success');
            renderSyncTab(tab);
          } catch (e) { showToast(`Pull failed: ${e.message}`, 'error'); }
        }),
      }));
      btnRow.appendChild(el('button', {
        className: 'btn btn-danger btn-sm',
        textContent: 'Sign Out',
        onClick: async () => {
          await signOut();
          showToast('Signed out', 'success');
          renderSyncTab(tab);
        },
      }));
      tab.appendChild(btnRow);
    }
  }
}
