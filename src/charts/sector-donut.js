import Plotly from 'plotly.js-dist-min';

const SECTOR_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#264653'];

export function renderSectorDonut(element, sectorData, title = 'Sector Distribution') {
  if (!sectorData || sectorData.length === 0) {
    element.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">No data</p>';
    return;
  }

  const data = [{
    type: 'pie',
    labels: sectorData.map(d => `Sector ${d.sector}`),
    values: sectorData.map(d => d.count),
    hole: 0.4,
    marker: { colors: SECTOR_COLORS.slice(0, sectorData.length) },
    textinfo: 'label+percent',
    hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>%{percent}<extra></extra>',
  }];

  const layout = {
    title: { text: title, font: { color: '#edf2f4' } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    height: 400,
    font: { color: '#edf2f4' },
    margin: { t: 60, b: 20 },
    showlegend: false,
  };

  Plotly.newPlot(element, data, layout, { responsive: true, displayModeBar: false });
}
