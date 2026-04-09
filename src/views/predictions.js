import { getDealers } from '../db/dealers.js';
import { getSpins, getSpinCount } from '../db/spins.js';
import { BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS, SECTORS } from '../core/wheel.js';
import { predict } from '../core/prediction.js';
import { el, selectInput, formGroup, metricCard, confidenceBadge } from '../ui/components.js';
import { renderPredictionDisplay } from '../charts/prediction-display.js';
import { showToast } from '../ui/notifications.js';

export async function renderPredictions(container) {
  const dealers = await getDealers();
  container.innerHTML = '';
  container.appendChild(el('h2', { textContent: 'Predictions' }));

  if (dealers.length === 0) {
    container.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No dealers found. Add a dealer from the Dashboard first.</p>' }));
    return;
  }

  let selectedDealerId = dealers[0].id;
  let conditions = { ballSize: null, spinSpeed: null, wheelSpeed: null, ballDirection: null };
  let topN = 5;
  let kernelSigma = 2.0;

  // Dealer selector
  const dealerSelect = selectInput(
    dealers.map(d => ({ value: d.id, label: `${d.name} (${d.spinCount} spins)` })),
    selectedDealerId,
    (val) => { selectedDealerId = Number(val); }
  );
  container.appendChild(formGroup('Select Dealer', dealerSelect));

  container.appendChild(el('hr', { className: 'divider' }));

  // Current conditions
  container.appendChild(el('h3', { textContent: 'Current Conditions' }));
  container.appendChild(el('p', { className: 'text-muted', textContent: 'Select current table conditions for tailored predictions' }));

  const condRow = el('div', { className: 'form-row' });
  condRow.append(
    formGroup('Ball Size', selectInput(
      [{ value: '', label: 'Any' }, ...BALL_SIZES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
      '', (v) => { conditions.ballSize = v || null; }
    )),
    formGroup('Spin Speed', selectInput(
      [{ value: '', label: 'Any' }, ...SPIN_SPEEDS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
      '', (v) => { conditions.spinSpeed = v || null; }
    )),
    formGroup('Wheel Speed', selectInput(
      [{ value: '', label: 'Any' }, ...WHEEL_SPEEDS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
      '', (v) => { conditions.wheelSpeed = v || null; }
    )),
    formGroup('Ball Direction', selectInput(
      [{ value: '', label: 'Any' }, { value: 'cw', label: 'Clockwise' }, { value: 'ccw', label: 'Counter-CW' }],
      '', (v) => { conditions.ballDirection = v || null; }
    )),
  );
  container.appendChild(condRow);

  // Advanced settings
  const advCard = el('div', { className: 'card' });
  advCard.appendChild(el('h3', { textContent: 'Advanced Settings' }));
  const topNInput = el('input', { type: 'range', min: '3', max: '15', value: '5' });
  const topNLabel = el('span', { textContent: ' 5' });
  topNInput.addEventListener('input', () => { topN = Number(topNInput.value); topNLabel.textContent = ` ${topN}`; });

  const sigmaInput = el('input', { type: 'range', min: '0.5', max: '5', step: '0.5', value: '2' });
  const sigmaLabel = el('span', { textContent: ' 2.0' });
  sigmaInput.addEventListener('input', () => { kernelSigma = Number(sigmaInput.value); sigmaLabel.textContent = ` ${kernelSigma.toFixed(1)}`; });

  advCard.append(
    formGroup('Top N numbers', el('div', {}, [topNInput, topNLabel])),
    formGroup('Kernel smoothing (sigma)', el('div', {}, [sigmaInput, sigmaLabel])),
    el('p', { className: 'text-muted', textContent: 'Higher sigma = broader zones. Lower = sharper focus on exact hits.' }),
  );
  container.appendChild(advCard);

  // Generate button
  const resultsArea = el('div');
  const generateBtn = el('button', {
    className: 'btn btn-primary btn-full',
    textContent: 'Generate Prediction',
    style: { marginBottom: '1.5rem' },
    onClick: async () => {
      const activeFilters = {};
      if (conditions.ballSize) activeFilters.ballSize = conditions.ballSize;
      if (conditions.spinSpeed) activeFilters.spinSpeed = conditions.spinSpeed;
      if (conditions.wheelSpeed) activeFilters.wheelSpeed = conditions.wheelSpeed;
      if (conditions.ballDirection) activeFilters.ballDirection = conditions.ballDirection;

      let spins = await getSpins(selectedDealerId, activeFilters);
      let usedFallback = false;

      if (spins.length < 30 && Object.keys(activeFilters).length > 0) {
        const totalCount = await getSpinCount(selectedDealerId);
        showToast(`Only ${spins.length} spins match. Falling back to all ${totalCount} spins.`, 'info');
        spins = await getSpins(selectedDealerId);
        usedFallback = true;
      }

      if (spins.length === 0) {
        resultsArea.innerHTML = '';
        resultsArea.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No spins recorded. Log some spins first.</p>' }));
        return;
      }

      const result = predict(spins, topN, kernelSigma);
      renderResults(result, usedFallback, spins);
    },
  });
  container.appendChild(generateBtn);
  container.appendChild(resultsArea);

  function renderResults(result, usedFallback, spins) {
    resultsArea.innerHTML = '';
    resultsArea.appendChild(el('hr', { className: 'divider' }));
    resultsArea.appendChild(el('h3', { textContent: 'Prediction Results' }));

    // Confidence + metrics
    const metricsRow = el('div', { className: 'metrics-row' });
    const confDiv = el('div', { className: 'metric-card', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }, [
      el('div', { className: 'metric-label', textContent: 'Confidence', style: { marginBottom: '0.3rem' } }),
      confidenceBadge(result.confidence),
    ]);
    metricsRow.append(confDiv, metricCard('Sample Size', result.sampleSize), metricCard('p-value', result.pValue.toFixed(4)));
    resultsArea.appendChild(metricsRow);

    if (usedFallback) {
      resultsArea.appendChild(el('p', { className: 'text-muted', textContent: 'Using all dealer spins (conditions filter had too few matches)' }));
    }

    resultsArea.appendChild(el('hr', { className: 'divider' }));

    // Two column layout: numbers + chart
    const layout = el('div', { className: 'chart-row' });

    // Left: ranked numbers + sectors
    const leftCol = el('div');
    leftCol.appendChild(el('h3', { textContent: `Top ${topN} Numbers` }));

    for (let i = 0; i < result.rankedNumbers.length; i++) {
      const [num, prob, advantage] = result.rankedNumbers[i];
      const advColor = advantage > 0 ? 'text-success' : 'text-danger';
      leftCol.appendChild(el('div', { className: 'card', style: { padding: '0.6rem 1rem', marginBottom: '0.5rem' } }, [
        el('span', { innerHTML: `<strong>#${i + 1}</strong> — Number <strong>${num}</strong> (${(prob * 100).toFixed(2)}%, <span class="${advColor}">${advantage > 0 ? '+' : ''}${advantage}%</span>)` }),
      ]));
    }

    leftCol.appendChild(el('hr', { className: 'divider' }));
    leftCol.appendChild(el('h3', { textContent: 'Hot Sectors' }));

    const maxSectorProb = Math.max(...result.sectorRankings.map(s => s[1]));
    for (const [name, sectorProb] of result.sectorRankings) {
      const expectedProb = SECTORS[name].length / 37;
      const advantage = ((sectorProb - expectedProb) / expectedProb * 100).toFixed(1);
      const barVal = Math.min(sectorProb / maxSectorProb, 1);

      const sectorDiv = el('div', { style: { marginBottom: '0.75rem' } }, [
        el('div', { innerHTML: `<strong>Sector ${name}</strong> — [${SECTORS[name].join(', ')}]` }),
        el('div', { className: 'text-muted', textContent: `${(sectorProb * 100).toFixed(1)}% (${Number(advantage) > 0 ? '+' : ''}${advantage}%)` }),
        el('div', { className: 'progress-bar' }, [
          el('div', { className: 'progress-fill', style: { width: `${barVal * 100}%` } }),
        ]),
      ]);
      leftCol.appendChild(sectorDiv);
    }

    // Right: prediction wheel chart
    const rightCol = el('div', { className: 'chart-container' });
    const allResult = predict(spins, 37, kernelSigma);
    renderPredictionDisplay(rightCol, allResult.rankedNumbers, allResult.sampleSize);

    layout.append(leftCol, rightCol);
    resultsArea.appendChild(layout);

    resultsArea.appendChild(el('hr', { className: 'divider' }));
    resultsArea.appendChild(el('p', {
      className: 'text-muted',
      textContent: 'These predictions are based on statistical patterns in recorded dealer spins. Roulette outcomes cannot be guaranteed. Use responsibly.',
    }));
  }
}
