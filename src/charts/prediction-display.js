import Plotly from 'plotly.js-dist-min';
import { WHEEL_ORDER, NUMBER_TO_ANGLE, TOTAL_POCKETS } from '../core/wheel.js';

export function renderPredictionDisplay(element, rankedNumbers, sampleSize) {
  if (!rankedNumbers || rankedNumbers.length === 0) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No predictions</p>';
    return;
  }

  const fairProb = 1 / TOTAL_POCKETS;
  const probs = new Map(rankedNumbers.map(([num, prob]) => [num, prob]));

  const angles = [];
  const values = [];
  const colors = [];
  const texts = [];

  for (const num of WHEEL_ORDER) {
    const prob = probs.get(num) || fairProb;
    angles.push(NUMBER_TO_ANGLE.get(num));
    values.push(prob * 100);

    const advantage = ((prob - fairProb) / fairProb) * 100;
    if (advantage > 20) colors.push('#e63946');
    else if (advantage > 10) colors.push('#f4a261');
    else if (advantage > 0) colors.push('#e9c46a');
    else colors.push('#457b9d');

    texts.push(`<b>${num}</b><br>Prob: ${(prob * 100).toFixed(2)}%<br>Adv: ${advantage > 0 ? '+' : ''}${advantage.toFixed(1)}%`);
  }

  const width = 360 / TOTAL_POCKETS - 0.5;
  const thetaRing = Array.from({ length: 100 }, (_, i) => (i / 100) * 360);

  const data = [
    {
      type: 'barpolar',
      r: values,
      theta: angles,
      width: Array(values.length).fill(width),
      marker: { color: colors, line: { color: 'rgba(255,255,255,0.3)', width: 1 } },
      text: texts,
      hoverinfo: 'text',
    },
    {
      type: 'scatterpolar',
      r: Array(100).fill(fairProb * 100),
      theta: thetaRing,
      mode: 'lines',
      line: { color: 'rgba(255,255,255,0.5)', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ];

  const layout = {
    title: { text: `Predicted Distribution (n=${sampleSize})`, font: { color: '#edf2f4' } },
    polar: {
      angularaxis: {
        tickvals: WHEEL_ORDER.map(n => NUMBER_TO_ANGLE.get(n)),
        ticktext: WHEEL_ORDER.map(String),
        direction: 'clockwise',
        rotation: 90,
        tickfont: { size: 9, color: '#8d99ae' },
      },
      radialaxis: { ticksuffix: '%', tickfont: { size: 8, color: '#8d99ae' } },
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
