import { getDealers } from '../db/dealers.js';
import { addSpin, getRecentSpins, deleteSpin } from '../db/spins.js';
import { WHEEL_ORDER, numberColor, BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, BALL_DIRECTIONS } from '../core/wheel.js';
import { el, selectInput, formGroup } from '../ui/components.js';
import { showToast } from '../ui/notifications.js';

export async function renderSpinLogger(container) {
  const dealers = await getDealers();
  container.innerHTML = '';

  container.appendChild(el('h2', { textContent: 'Spin Logger' }));

  if (dealers.length === 0) {
    container.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No dealers found. Add a dealer from the Dashboard first.</p>' }));
    return;
  }

  // State
  let selectedDealerId = dealers[0].id;
  let formState = { ballSize: null, spinSpeed: null, wheelSpeed: null, ballDirection: null, sessionTag: '', notes: '' };

  // Dealer selector
  const dealerSelect = selectInput(
    dealers.map(d => ({ value: d.id, label: d.name })),
    selectedDealerId,
    (val) => { selectedDealerId = Number(val); refreshRecent(); }
  );
  container.appendChild(formGroup('Select Dealer', dealerSelect));
  container.appendChild(el('hr', { className: 'divider' }));

  // Spin entry form
  container.appendChild(el('h3', { textContent: 'Log a Spin' }));
  const form = el('div', { className: 'card' });

  const numInput = el('input', { type: 'number', min: '0', max: '36', value: '0' });
  const ballSizeSelect = selectInput(
    [{ value: '', label: 'Unknown' }, ...BALL_SIZES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))],
    '', (v) => { formState.ballSize = v || null; }
  );
  const spinSpeedSelect = selectInput(
    [{ value: '', label: 'Unknown' }, ...SPIN_SPEEDS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))],
    '', (v) => { formState.spinSpeed = v || null; }
  );
  const wheelSpeedSelect = selectInput(
    [{ value: '', label: 'Unknown' }, ...WHEEL_SPEEDS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))],
    '', (v) => { formState.wheelSpeed = v || null; }
  );
  const ballDirSelect = selectInput(
    [{ value: '', label: 'Unknown' }, { value: 'cw', label: 'Clockwise' }, { value: 'ccw', label: 'Counter-CW' }],
    '', (v) => { formState.ballDirection = v || null; }
  );
  const sessionInput = el('input', { type: 'text', placeholder: 'Session tag (optional)' });
  const notesInput = el('input', { type: 'text', placeholder: 'Notes (optional)' });

  const row1 = el('div', { className: 'form-row' }, [
    formGroup('Result Number', numInput),
    formGroup('Ball Size', ballSizeSelect),
    formGroup('Spin Speed', spinSpeedSelect),
  ]);
  const row2 = el('div', { className: 'form-row' }, [
    formGroup('Wheel Speed', wheelSpeedSelect),
    formGroup('Ball Direction', ballDirSelect),
    formGroup('Session Tag', sessionInput),
  ]);

  const submitBtn = el('button', {
    className: 'btn btn-primary btn-full',
    textContent: 'Log Spin',
    onClick: async () => {
      const num = parseInt(numInput.value);
      if (isNaN(num) || num < 0 || num > 36) return showToast('Invalid number (0-36)', 'error');
      await addSpin(selectedDealerId, num, {
        ...formState,
        sessionTag: sessionInput.value,
        notes: notesInput.value,
      });
      const color = numberColor(num);
      showToast(`Logged: ${num} (${color})`, 'success');
      refreshRecent();
    },
  });

  form.append(row1, row2, formGroup('Notes', notesInput), submitBtn);
  container.appendChild(form);
  container.appendChild(el('hr', { className: 'divider' }));

  // Quick number grid
  container.appendChild(el('h3', { textContent: 'Quick Log (tap a number)' }));
  container.appendChild(el('p', { className: 'text-muted', textContent: 'Logs with current form settings' }));

  const grid = el('div', { className: 'number-grid' });
  for (let num = 0; num <= 36; num++) {
    const color = numberColor(num);
    const btn = el('button', {
      className: `num-btn ${color}`,
      textContent: String(num),
      onClick: async () => {
        await addSpin(selectedDealerId, num, {
          ...formState,
          sessionTag: sessionInput.value,
          notes: notesInput.value,
        });
        showToast(`Logged: ${num}`, 'success');
        refreshRecent();
      },
    });
    grid.appendChild(btn);
  }
  container.appendChild(grid);
  container.appendChild(el('hr', { className: 'divider' }));

  // Recent spins
  container.appendChild(el('h3', { textContent: 'Recent Spins' }));
  const recentContainer = el('div', { id: 'recent-spins' });
  container.appendChild(recentContainer);

  async function refreshRecent() {
    const recent = await getRecentSpins(selectedDealerId, 20);
    recentContainer.innerHTML = '';

    if (recent.length === 0) {
      recentContainer.appendChild(el('p', { className: 'text-muted', textContent: 'No spins recorded yet for this dealer.' }));
      return;
    }

    for (const spin of recent) {
      const color = numberColor(spin.resultNumber);
      const icon = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫';

      const details = [];
      if (spin.ballSize) details.push(`Ball: ${spin.ballSize}`);
      if (spin.spinSpeed) details.push(`Spin: ${spin.spinSpeed}`);
      if (spin.wheelSpeed) details.push(`Wheel: ${spin.wheelSpeed}`);
      if (spin.ballDirection) details.push(`Dir: ${spin.ballDirection === 'cw' ? 'CW' : 'CCW'}`);

      const item = el('div', { className: 'spin-item' }, [
        el('div', { className: 'spin-number', textContent: `${icon} ${spin.resultNumber}` }),
        el('div', { className: 'spin-details', textContent: details.length ? details.join(' · ') : 'No parameters recorded' }),
        el('button', {
          className: 'btn btn-sm btn-danger',
          textContent: 'Delete',
          onClick: async () => {
            await deleteSpin(spin.id);
            refreshRecent();
          },
        }),
      ]);
      recentContainer.appendChild(item);
    }
  }

  refreshRecent();
}
