/** Lightweight DOM helper functions. */

export function el(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') elem.className = val;
    else if (key === 'textContent') elem.textContent = val;
    else if (key === 'innerHTML') elem.innerHTML = val;
    else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') Object.assign(elem.style, val);
    else elem.setAttribute(key, val);
  }

  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else if (child) elem.appendChild(child);
  }

  return elem;
}

export function metricCard(label, value) {
  return el('div', { className: 'metric-card' }, [
    el('div', { className: 'metric-value', textContent: String(value) }),
    el('div', { className: 'metric-label', textContent: label }),
  ]);
}

export function selectInput(options, value, onChange, opts = {}) {
  const select = el('select', {
    onChange: (e) => onChange(e.target.value),
  });
  for (const opt of options) {
    const optEl = el('option', { value: opt.value, textContent: opt.label });
    if (opt.value === value) optEl.selected = true;
    select.appendChild(optEl);
  }
  return select;
}

export function formGroup(label, input) {
  return el('div', { className: 'form-group' }, [
    el('label', { textContent: label }),
    input,
  ]);
}

export function createTable(headers, rows) {
  const thead = el('thead', {}, [
    el('tr', {}, headers.map(h => el('th', { textContent: h }))),
  ]);

  const tbody = el('tbody', {},
    rows.map(row =>
      el('tr', {}, row.map(cell => {
        if (typeof cell === 'string' || typeof cell === 'number') {
          return el('td', { textContent: String(cell) });
        }
        return el('td', {}, [cell]); // DOM element
      }))
    )
  );

  return el('table', {}, [thead, tbody]);
}

export function createTabs(tabDefs) {
  const tabBar = el('div', { className: 'tabs' });
  const tabContents = [];

  tabDefs.forEach((def, i) => {
    const btn = el('button', {
      className: `tab-btn${i === 0 ? ' active' : ''}`,
      textContent: def.label,
      onClick: () => {
        tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tabContents.forEach((c, j) => c.classList.toggle('active', j === i));
      },
    });
    tabBar.appendChild(btn);

    const content = el('div', { className: `tab-content${i === 0 ? ' active' : ''}` });
    def.render(content);
    tabContents.push(content);
  });

  return el('div', {}, [tabBar, ...tabContents]);
}

export function showModal(title, message, onConfirm) {
  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal' }, [
    el('h3', { textContent: title }),
    el('p', { textContent: message }),
    el('div', { className: 'modal-actions' }, [
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Cancel',
        onClick: () => overlay.remove(),
      }),
      el('button', {
        className: 'btn btn-danger',
        textContent: 'Confirm',
        onClick: () => { overlay.remove(); onConfirm(); },
      }),
    ]),
  ]);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function confidenceBadge(level) {
  const badges = {
    low: { text: '🔴 Insufficient Data', cls: 'badge-low' },
    medium: { text: '🟡 Suggestive', cls: 'badge-medium' },
    high: { text: '🟢 Significant', cls: 'badge-high' },
  };
  const b = badges[level] || badges.low;
  return el('span', { className: `badge ${b.cls}`, textContent: b.text });
}
