const views = {};
let currentView = null;

export function registerView(name, renderFn) {
  views[name] = renderFn;
}

export function navigateTo(viewName) {
  window.location.hash = viewName;
}

export function initRouter() {
  const content = document.getElementById('content');

  async function render() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const renderFn = views[hash];

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === hash);
    });

    if (renderFn) {
      content.innerHTML = '<div class="loading">Loading...</div>';
      currentView = hash;
      try {
        await renderFn(content);
      } catch (err) {
        content.innerHTML = `<div class="card"><h2>Error</h2><p class="text-danger">${err.message}</p></div>`;
        console.error(err);
      }
    } else {
      content.innerHTML = '<div class="loading">View not found</div>';
    }
  }

  window.addEventListener('hashchange', render);
  render();
}
