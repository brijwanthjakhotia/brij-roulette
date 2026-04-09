import { getDealers, addDealer, getTotalStats } from '../db/dealers.js';
import { getSpins } from '../db/spins.js';
import { chiSquaredTest, confidenceLevel } from '../core/statistics.js';
import { el, metricCard, confidenceBadge } from '../ui/components.js';
import { showToast } from '../ui/notifications.js';

export async function renderDashboard(container) {
  const stats = await getTotalStats();
  const dealers = await getDealers();

  container.innerHTML = '';

  // Header
  container.appendChild(el('h2', { textContent: 'Dashboard' }));

  // Metrics
  const metrics = el('div', { className: 'metrics-row' }, [
    metricCard('Total Dealers', stats.dealerCount),
    metricCard('Total Spins', stats.spinCount),
  ]);
  container.appendChild(metrics);
  container.appendChild(el('hr', { className: 'divider' }));

  // Dealer list
  if (dealers.length === 0) {
    container.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No dealers yet. Add your first dealer below to get started.</p>' }));
  } else {
    container.appendChild(el('h3', { textContent: 'Dealers' }));

    for (const dealer of dealers) {
      const card = el('div', { className: 'card' });
      const row = el('div', { className: 'card-row' });

      const info = el('div', {}, [
        el('strong', { textContent: dealer.name }),
        ...(dealer.notes ? [el('p', { className: 'text-muted', textContent: dealer.notes })] : []),
      ]);

      const statsDiv = el('div', { style: { display: 'flex', alignItems: 'center', gap: '1.5rem' } });
      statsDiv.appendChild(el('div', { className: 'metric-card', style: { padding: '0.5rem 1rem' } }, [
        el('div', { className: 'metric-value', textContent: String(dealer.spinCount), style: { fontSize: '1.2rem' } }),
        el('div', { className: 'metric-label', textContent: 'Spins' }),
      ]));

      // Signature strength
      if (dealer.spinCount > 0) {
        const spins = await getSpins(dealer.id);
        const chi2 = chiSquaredTest(spins);
        const conf = confidenceLevel(chi2.sampleSize, chi2.pValue);
        statsDiv.appendChild(el('div', {}, [
          el('div', { className: 'text-muted', textContent: 'Signature', style: { fontSize: '0.75rem', marginBottom: '0.2rem' } }),
          confidenceBadge(conf),
        ]));
      }

      row.appendChild(info);
      row.appendChild(statsDiv);
      card.appendChild(row);
      container.appendChild(card);
    }
  }

  container.appendChild(el('hr', { className: 'divider' }));

  // Add dealer form
  container.appendChild(el('h3', { textContent: 'Add New Dealer' }));
  const form = el('form', { className: 'card' });

  const nameInput = el('input', { type: 'text', placeholder: 'Dealer name', required: 'true' });
  const notesInput = el('textarea', { placeholder: 'Notes (optional)', rows: '2' });

  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Name' }), nameInput,
  ]));
  form.appendChild(el('div', { className: 'form-group' }, [
    el('label', { textContent: 'Notes' }), notesInput,
  ]));
  form.appendChild(el('button', { type: 'submit', className: 'btn btn-primary btn-full', textContent: 'Add Dealer' }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return showToast('Dealer name is required', 'error');
    try {
      await addDealer(name, notesInput.value);
      showToast(`Dealer '${name}' added!`, 'success');
      renderDashboard(container);
    } catch (err) {
      if (err.message.includes('already exists') || err.name === 'ConstraintError') {
        showToast(`Dealer '${name}' already exists`, 'error');
      } else {
        showToast(`Error: ${err.message}`, 'error');
      }
    }
  });

  container.appendChild(form);
}
