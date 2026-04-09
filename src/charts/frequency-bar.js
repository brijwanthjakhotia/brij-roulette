import Plotly from 'plotly.js-dist-min';
import { WHEEL_ORDER, numberColor } from '../core/wheel.js';

const COLOR_MAP = { red: '#e63946', black: '#2b2d42', green: '#2a9d8f' };

export function renderFrequencyBar(element, freqData, title = 'Number Frequency') {
  if (!freqData || freqData.length === 0) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No data</p>';
    return;
  }

  const sorted = [...freqData].sort((a, b) => a.wheelPosition - b.wheelPosition);
  const colors = WHEEL_ORDER.map(n => COLOR_MAP[numberColor(n)]);
  const expected = sorted[0]?.expected || 0;

  const data = [{
    type: 'bar',
    x: sorted.map(d => String(d.number)),
    y: sorted.map(d => d.count),
    marker: { color: colors },
    text: sorted.map(d => String(d.count)),
    textposition: 'outside',
    hovertemplate: '<b>%{x}</b><br>Count: %{y}<br>Dev: %{customdata}%<extra></extra>',
    customdata: sorted.map(d => (d.deviationPct > 0 ? '+' : '') + d.deviationPct),
  }];

  const layout = {
    title: { text: title, font: { color: '#edf2f4' } },
    xaxis: { title: 'Number (wheel order)', tickfont: { color: '#8d99ae' } },
    yaxis: { title: 'Count', tickfont: { color: '#8d99ae' } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 350,
    font: { color: '#edf2f4' },
    margin: { t: 60, b: 40 },
    shapes: [{
      type: 'line', y0: expected, y1: expected, x0: 0, x1: 1, xref: 'paper',
      line: { color: 'rgba(255,255,255,0.5)', width: 1, dash: 'dash' },
    }],
  };

  Plotly.newPlot(element, data, layout, { responsive: true, displayModeBar: false });
}
