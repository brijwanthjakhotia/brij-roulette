import { getDealers } from '../db/dealers.js';
import { getSpins } from '../db/spins.js';
import { BALL_SIZES, SPIN_SPEEDS, WHEEL_SPEEDS } from '../core/wheel.js';
import { frequencyDistribution, chiSquaredTest, sectorFrequencies, sectorChiSquared, conditionalAnalysis, confidenceLevel } from '../core/statistics.js';
import { el, selectInput, formGroup, metricCard, confidenceBadge, createTable } from '../ui/components.js';
import { renderWheelHeatmap } from '../charts/wheel-heatmap.js';
import { renderSectorDonut } from '../charts/sector-donut.js';
import { renderFrequencyBar } from '../charts/frequency-bar.js';
import { renderComparisonPolar } from '../charts/comparison-polar.js';
import { renderSpinTimeline } from '../charts/spin-timeline.js';

export async function renderAnalysis(container) {
  const dealers = await getDealers();
  container.innerHTML = '';
  container.appendChild(el('h2', { textContent: 'Analysis' }));

  if (dealers.length === 0) {
    container.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No dealers found. Add a dealer from the Dashboard first.</p>' }));
    return;
  }

  let selectedDealerId = dealers[0].id;
  let filters = { ballSize: null, spinSpeed: null, wheelSpeed: null, ballDirection: null };

  const analysisContent = el('div');

  // Dealer selector
  const dealerSelect = selectInput(
    dealers.map(d => ({ value: d.id, label: d.name })),
    selectedDealerId,
    (val) => { selectedDealerId = Number(val); refresh(); }
  );
  container.appendChild(formGroup('Select Dealer', dealerSelect));

  // Filters
  const filterCard = el('div', { className: 'card' });
  filterCard.appendChild(el('h3', { textContent: 'Filters', style: { marginBottom: '0.75rem' } }));
  const filterRow = el('div', { className: 'form-row' });

  const bsSelect = selectInput(
    [{ value: '', label: 'All' }, ...BALL_SIZES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
    '', (v) => { filters.ballSize = v || null; refresh(); }
  );
  const ssSelect = selectInput(
    [{ value: '', label: 'All' }, ...SPIN_SPEEDS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
    '', (v) => { filters.spinSpeed = v || null; refresh(); }
  );
  const wsSelect = selectInput(
    [{ value: '', label: 'All' }, ...WHEEL_SPEEDS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))],
    '', (v) => { filters.wheelSpeed = v || null; refresh(); }
  );
  const bdSelect = selectInput(
    [{ value: '', label: 'All' }, { value: 'cw', label: 'Clockwise' }, { value: 'ccw', label: 'Counter-CW' }],
    '', (v) => { filters.ballDirection = v || null; refresh(); }
  );

  filterRow.append(
    formGroup('Ball Size', bsSelect),
    formGroup('Spin Speed', ssSelect),
    formGroup('Wheel Speed', wsSelect),
    formGroup('Ball Direction', bdSelect),
  );
  filterCard.appendChild(filterRow);
  container.appendChild(filterCard);

  container.appendChild(analysisContent);

  async function refresh() {
    analysisContent.innerHTML = '<div class="loading">Analyzing...</div>';

    const activeFilters = {};
    if (filters.ballSize) activeFilters.ballSize = filters.ballSize;
    if (filters.spinSpeed) activeFilters.spinSpeed = filters.spinSpeed;
    if (filters.wheelSpeed) activeFilters.wheelSpeed = filters.wheelSpeed;
    if (filters.ballDirection) activeFilters.ballDirection = filters.ballDirection;

    const spins = await getSpins(selectedDealerId, activeFilters);
    analysisContent.innerHTML = '';

    if (spins.length === 0) {
      analysisContent.appendChild(el('div', { className: 'card', innerHTML: '<p class="text-muted">No spins match the current filters.</p>' }));
      return;
    }

    // Metrics
    const chi2 = chiSquaredTest(spins);
    const conf = confidenceLevel(chi2.sampleSize, chi2.pValue);

    const metrics = el('div', { className: 'metrics-row' }, [
      metricCard('Spins', chi2.sampleSize),
      metricCard('Chi-squared', chi2.chi2.toFixed(1)),
      metricCard('p-value', chi2.pValue.toFixed(4)),
    ]);
    const confDiv = el('div', { className: 'metric-card', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }, [
      el('div', { className: 'metric-label', textContent: 'Confidence', style: { marginBottom: '0.3rem' } }),
      confidenceBadge(conf),
    ]);
    metrics.appendChild(confDiv);
    analysisContent.appendChild(metrics);

    if (chi2.sampleSize < 185) {
      analysisContent.appendChild(el('p', { className: 'text-muted', textContent: `${chi2.sampleSize} spins recorded. At least 185 recommended for reliable per-number analysis.` }));
    }

    analysisContent.appendChild(el('hr', { className: 'divider' }));

    // Charts: wheel heatmap + sector donut
    const freqData = frequencyDistribution(spins);
    const sectData = sectorFrequencies(spins);

    const chartRow = el('div', { className: 'chart-row' });
    const heatmapDiv = el('div', { className: 'chart-container' });
    const donutDiv = el('div', { className: 'chart-container' });
    chartRow.append(heatmapDiv, donutDiv);
    analysisContent.appendChild(chartRow);

    renderWheelHeatmap(heatmapDiv, freqData);
    renderSectorDonut(donutDiv, sectData);

    // Sector chi-squared caption
    const sectChi = sectorChiSquared(spins);
    analysisContent.appendChild(el('p', { className: 'text-muted', textContent: `Sector chi-squared: ${sectChi.chi2.toFixed(1)} (p=${sectChi.pValue.toFixed(4)})` }));

    // Frequency bar chart
    const barDiv = el('div', { className: 'chart-container' });
    analysisContent.appendChild(barDiv);
    renderFrequencyBar(barDiv, freqData);

    // Top numbers table
    analysisContent.appendChild(el('hr', { className: 'divider' }));
    analysisContent.appendChild(el('h3', { textContent: 'Top Numbers' }));

    const topNums = [...freqData].sort((a, b) => b.count - a.count).slice(0, 10);
    const table = createTable(
      ['Number', 'Count', 'Expected', 'Deviation %', 'Probability'],
      topNums.map(d => [d.number, d.count, d.expected, `${d.deviationPct > 0 ? '+' : ''}${d.deviationPct}%`, (d.probability * 100).toFixed(2) + '%'])
    );
    analysisContent.appendChild(table);

    // Conditional comparison
    analysisContent.appendChild(el('hr', { className: 'divider' }));
    analysisContent.appendChild(el('h3', { textContent: 'Conditional Comparison' }));

    const condFields = [
      { value: 'ballSize', label: 'Ball Size' },
      { value: 'spinSpeed', label: 'Spin Speed' },
      { value: 'wheelSpeed', label: 'Wheel Speed' },
      { value: 'ballDirection', label: 'Ball Direction' },
    ];

    let selectedCondField = 'ballSize';
    const comparisonArea = el('div');

    const condSelect = selectInput(condFields, selectedCondField, (v) => {
      selectedCondField = v;
      renderComparison();
    });
    analysisContent.appendChild(formGroup('Compare by', condSelect));
    analysisContent.appendChild(comparisonArea);

    async function renderComparison() {
      comparisonArea.innerHTML = '';
      const allSpins = await getSpins(selectedDealerId);
      const condResults = conditionalAnalysis(allSpins, selectedCondField);
      const keys = Object.keys(condResults);

      if (keys.length < 2) {
        comparisonArea.appendChild(el('p', { className: 'text-muted', textContent: `Need at least 2 different values for this field to compare.` }));
        return;
      }

      const selectRow = el('div', { className: 'form-row' });
      let valA = keys[0], valB = keys[Math.min(1, keys.length - 1)];

      const selA = selectInput(keys.map(k => ({ value: k, label: k })), valA, (v) => { valA = v; drawComparison(); });
      const selB = selectInput(keys.map(k => ({ value: k, label: k })), valB, (v) => { valB = v; drawComparison(); });
      selectRow.append(formGroup('Condition A', selA), formGroup('Condition B', selB));
      comparisonArea.appendChild(selectRow);

      const compChart = el('div', { className: 'chart-container' });
      comparisonArea.appendChild(compChart);

      function drawComparison() {
        if (valA !== valB) {
          renderComparisonPolar(compChart, condResults[valA], condResults[valB], valA, valB);
        }
      }
      drawComparison();
    }
    renderComparison();

    // Spin timeline
    analysisContent.appendChild(el('hr', { className: 'divider' }));
    analysisContent.appendChild(el('h3', { textContent: 'Spin Timeline' }));
    const timelineDiv = el('div', { className: 'chart-container' });
    analysisContent.appendChild(timelineDiv);
    renderSpinTimeline(timelineDiv, spins);
  }

  refresh();
}
