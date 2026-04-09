import Plotly from 'plotly.js-dist-min';
import { WHEEL_ORDER, NUMBER_TO_ANGLE, TOTAL_POCKETS } from '../core/wheel.js';

export function renderComparisonPolar(element, freqA, freqB, labelA, labelB) {
  if ((!freqA || freqA.length === 0) && (!freqB || freqB.length === 0)) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No data</p>';
    return;
  }

  const width = 360 / TOTAL_POCKETS - 0.5;
  const angularAxis = {
    tickvals: WHEEL_ORDER.map(n => NUMBER_TO_ANGLE.get(n)),
    ticktext: WHEEL_ORDER.map(String),
    direction: 'clockwise',
    rotation: 90,
    tickfont: { size: 7, color: '#8d99ae' },
  };

  const makeTrace = (freq, color, name, polar) => {
    if (!freq || freq.length === 0) return null;
    const sorted = [...freq].sort((a, b) => a.wheelPosition - b.wheelPosition);
    return {
      type: 'barpolar',
      r: sorted.map(d => d.count),
      theta: sorted.map(d => NUMBER_TO_ANGLE.get(d.number)),
      width: Array(sorted.length).fill(width),
      marker: { color },
      text: sorted.map(d => `${d.number}: ${d.count}`),
      hoverinfo: 'text',
      name,
      subplot: polar,
    };
  };

  const traces = [
    makeTrace(freqA, '#e63946', labelA, 'polar'),
    makeTrace(freqB, '#457b9d', labelB, 'polar2'),
  ].filter(Boolean);

  const layout = {
    polar: { domain: { x: [0, 0.45] }, angularaxis: angularAxis, radialaxis: { tickfont: { size: 7 } }, bgcolor: 'rgba(0,0,0,0)' },
    polar2: { domain: { x: [0.55, 1] }, angularaxis: angularAxis, radialaxis: { tickfont: { size: 7 } }, bgcolor: 'rgba(0,0,0,0)' },
    annotations: [
      { text: labelA, x: 0.22, y: 1.08, xref: 'paper', yref: 'paper', showarrow: false, font: { color: '#edf2f4', size: 14 } },
      { text: labelB, x: 0.78, y: 1.08, xref: 'paper', yref: 'paper', showarrow: false, font: { color: '#edf2f4', size: 14 } },
    ],
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 400,
    font: { color: '#edf2f4' },
    showlegend: false,
    margin: { t: 60, b: 20 },
  };

  Plotly.newPlot(element, traces, layout, { responsive: true, displayModeBar: false });
}
