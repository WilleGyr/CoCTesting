export const COLORS = {
  accent: '#f59e0b',
  positive: '#4ade80',
  negative: '#f87171',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
  border: '#27272a',
};

let applied = false;
export function applyChartDefaults() {
  if (applied || typeof Chart === 'undefined') return;
  Chart.defaults.color = COLORS.muted;
  Chart.defaults.borderColor = COLORS.border;
  Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.tooltip.backgroundColor = '#18181b';
  Chart.defaults.plugins.tooltip.borderColor = '#3f3f46';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = COLORS.text;
  Chart.defaults.plugins.tooltip.bodyColor = COLORS.text;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  applied = true;
}
