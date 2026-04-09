import Plotly from 'plotly.js-dist-min';
import { NUMBER_TO_POSITION, TOTAL_POCKETS, WHEEL_ORDER, numberColor } from '../core/wheel.js';

const COLOR_MAP = { red: '#e63946', black: '#8d99ae', green: '#2a9d8f' };

export function renderSpinTimeline(element, spins, title = 'Spin Timeline') {
  if (!spins || spins.length === 0) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No data</p>';
    return;
  }

  const sorted = [...spins].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const wheelPositions = sorted.map(s => NUMBER_TO_POSITION.get(s.resultNumber));
  const colors = sorted.map(s => COLOR_MAP[numberColor(s.resultNumber)]);

  const tickPositions = [];
  const tickLabels = [];
  for (let i = 0; i < TOTAL_POCKETS; i += 3) {
    tickPositions.push(i);
    tickLabels.push(String(WHEEL_ORDER[i]));
  }

  const data = [{
    type: 'scatter',
    x: sorted.map((_, i) => i + 1),
    y: wheelPositions,
    mode: 'markers+lines',
    marker: { color: colors, size: 8 },
    line: { color: 'rgba(255,255,255,0.2)', width: 1 },
    text: sorted.map((s, i) => `Spin ${i + 1}: ${s.resultNumber}`),
    hoverinfo: 'text',
  }];

  const layout = {
    title: { text: title, font: { color: '#edf2f4' } },
    xaxis: { title: 'Spin #', tickfont: { color: '#8d99ae' } },
    yaxis: {
      title: 'Wheel Position',
      tickvals: tickPositions,
      ticktext: tickLabels,
      tickfont: { color: '#8d99ae' },
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 350,
    font: { color: '#edf2f4' },
    margin: { t: 60, b: 40 },
  };

  Plotly.newPlot(element, data, layout, { responsive: true, displayModeBar: false });
}
