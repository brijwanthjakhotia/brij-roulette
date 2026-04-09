import { registerView, initRouter } from './router.js';
import { getTotalStats } from './db/dealers.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSpinLogger } from './views/spin-logger.js';
import { renderAnalysis } from './views/analysis.js';
import { renderPredictions } from './views/predictions.js';
import { renderDataManagement } from './views/data-management.js';

// Register all views
registerView('dashboard', renderDashboard);
registerView('spin-logger', renderSpinLogger);
registerView('analysis', renderAnalysis);
registerView('predictions', renderPredictions);
registerView('data-management', renderDataManagement);

// Update global stats in sidebar
async function updateGlobalStats() {
  const stats = await getTotalStats();
  const el = document.getElementById('global-stats');
  if (el) el.textContent = `${stats.dealerCount} dealers · ${stats.spinCount} spins`;
}

// Init
updateGlobalStats();
initRouter();

// Re-update stats on hash change (view navigation)
window.addEventListener('hashchange', () => setTimeout(updateGlobalStats, 100));
