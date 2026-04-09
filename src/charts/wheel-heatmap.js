import Plotly from 'plotly.js-dist-min';
import { WHEEL_ORDER, NUMBER_TO_ANGLE, TOTAL_POCKETS } from '../core/wheel.js';

export function renderWheelHeatmap(element, freqData, title = 'Wheel Heatmap') {
  if (!freqData || freqData.length === 0) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No data</p>';
    return;
  }

  const sorted = [...freqData].sort((a, b) => a.wheelPosition - b.wheelPosition);
  const angles = sorted.map(d => NUMBER_TO_ANGLE.get(d.number));
  const width = 360 / TOTAL_POCKETS - 0.5;

  const maxDev = Math.max(
    Math.abs(Math.max(...sorted.map(d => d.deviationPct))),
    Math.abs(Math.min(...sorted.map(d => d.deviationPct))),
    1
  );

  const colors = sorted.map(d => {
    const val = d.deviationPct / maxDev;
    if (val > 0) {
      return `rgb(230,${Math.round(57 + (1 - val) * 180)},${Math.round(70 + (1 - val) * 180)})`;
    }
    return `rgb(${Math.round(42 + (1 + val) * 180)},${Math.round(157 + (1 + val) * 80)},${Math.round(143 + (1 + val) * 100)})`;
  });

  const expected = sorted[0]?.expected || 0;
  const thetaRing = Array.from({ length: 100 }, (_, i) => (i / 100) * 360);

  const data = [
    {
      type: 'barpolar',
      r: sorted.map(d => d.count),
      theta: angles,
      width: Array(sorted.length).fill(width),
      marker: { color: colors, line: { color: 'rgba(255,255,255,0.3)', width: 1 } },
      text: sorted.map(d => `<b>${d.number}</b><br>Count: ${d.count}<br>Dev: ${d.deviationPct > 0 ? '+' : ''}${d.deviationPct}%`),
      hoverinfo: 'text',
    },
    {
      type: 'scatterpolar',
      r: Array(100).fill(expected),
      theta: thetaRing,
      mode: 'lines',
      line: { color: 'rgba(255,255,255,0.5)', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ];

  const layout = {
    title: { text: title, font: { color: '#edf2f4' } },
    polar: {
      angularaxis: {
        tickvals: WHEEL_ORDER.map(n => NUMBER_TO_ANGLE.get(n)),
        ticktext: WHEEL_ORDER.map(String),
        direction: 'clockwise',
        rotation: 90,
        tickfont: { size: 9, color: '#8d99ae' },
      },
      radialaxis: { tickfont: { size: 8, color: '#8d99ae' } },
      bgcolor: 'rgba(0,0,0,0)',
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 500,
    margin: { t: 60, b: 20, l: 20, r: 20 },
    font: { color: '#edf2f4' },
  };

  Plotly.newPlot(element, data, layout, { responsive: true, displayModeBar: false });
}
