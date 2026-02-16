/**
 * charts.js - Chart.js rendering functions for the Costco Spending Analyzer.
 *
 * Exports a global CostcoCharts object.
 */
const CostcoCharts = (() => {

  const chartInstances = {};

  const COLORS = {
    primary: 'rgba(79, 70, 229, 0.8)',
    primaryBorder: 'rgba(79, 70, 229, 1)',
    danger: 'rgba(239, 68, 68, 0.75)',
    dangerBorder: 'rgba(239, 68, 68, 1)',
    success: 'rgba(16, 185, 129, 0.8)',
    successBorder: 'rgba(16, 185, 129, 1)',
    warning: 'rgba(245, 158, 11, 0.8)',
    warningBorder: 'rgba(245, 158, 11, 1)',
    purple: 'rgba(139, 92, 246, 0.8)',
    purpleBorder: 'rgba(139, 92, 246, 1)',
    teal: 'rgba(20, 184, 166, 0.8)',
    tealBorder: 'rgba(20, 184, 166, 1)'
  };

  const PALETTE = [
    'rgba(79, 70, 229, 0.7)',
    'rgba(16, 185, 129, 0.7)',
    'rgba(245, 158, 11, 0.7)',
    'rgba(239, 68, 68, 0.7)',
    'rgba(139, 92, 246, 0.7)',
    'rgba(20, 184, 166, 0.7)',
    'rgba(249, 115, 22, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(59, 130, 246, 0.7)',
    'rgba(14, 165, 233, 0.7)',
    'rgba(132, 204, 22, 0.7)',
    'rgba(244, 63, 94, 0.7)'
  ];

  function getTextColor() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return isDark ? 'rgba(241, 245, 249, 0.9)' : 'rgba(15, 23, 42, 0.85)';
  }

  function getGridColor() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)';
  }

  function getOrCreate(id, config) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
    }
    const ctx = document.getElementById(id);
    if (!ctx) return null;

    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    Chart.defaults.font.size = 12;

    chartInstances[id] = new Chart(ctx, config);
    return chartInstances[id];
  }

  function baseOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: getTextColor(), font: { size: 12 } }
        },
        tooltip: {
          callbacks: {}
        }
      },
      scales: {}
    };
  }

  function dollarTooltip() {
    return {
      callbacks: {
        label: (ctx) => {
          const label = ctx.dataset.label || ctx.label || '';
          const val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
          return `${label}: $${val.toFixed(2)}`;
        }
      }
    };
  }

  /* ---- Monthly Spending (stacked bar) ---- */

  function renderMonthlySpending(data) {
    getOrCreate('chart-monthly-spending', {
      type: 'bar',
      data: {
        labels: data.labels.map(formatMonthLabel),
        datasets: [
          {
            label: 'Purchases',
            data: data.purchases,
            backgroundColor: COLORS.primary,
            borderColor: COLORS.primaryBorder,
            borderWidth: 1
          },
          {
            label: 'Returns',
            data: data.returns,
            backgroundColor: COLORS.danger,
            borderColor: COLORS.dangerBorder,
            borderWidth: 1
          }
        ]
      },
      options: {
        ...baseOptions(),
        plugins: {
          legend: { labels: { color: getTextColor() } },
          tooltip: dollarTooltip()
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: getTextColor() },
            grid: { color: getGridColor() }
          },
          y: {
            stacked: true,
            ticks: {
              color: getTextColor(),
              callback: (v) => '$' + v
            },
            grid: { color: getGridColor() }
          }
        }
      }
    });
  }

  /* ---- Department Spending (horizontal bar) ---- */

  function renderDepartment(data) {
    getOrCreate('chart-department', {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Spending',
          data: data.values,
          backgroundColor: data.labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1
        }]
      },
      options: {
        ...baseOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: dollarTooltip()
        },
        scales: {
          x: {
            ticks: {
              color: getTextColor(),
              callback: (v) => '$' + v
            },
            grid: { color: getGridColor() }
          },
          y: {
            ticks: { color: getTextColor(), font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* ---- Basket Size Over Time (line) ---- */

  function renderBasketSize(data) {
    getOrCreate('chart-basket-size', {
      type: 'line',
      data: {
        labels: data.labels.map(formatMonthLabel),
        datasets: [{
          label: 'Avg Items per Trip',
          data: data.values,
          borderColor: COLORS.tealBorder,
          backgroundColor: COLORS.teal,
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        ...baseOptions(),
        plugins: {
          legend: { labels: { color: getTextColor() } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} items`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: getTextColor() },
            grid: { color: getGridColor() }
          },
          y: {
            ticks: { color: getTextColor() },
            grid: { color: getGridColor() },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ---- Top Frequency (horizontal bar) ---- */

  function renderTopFrequency(data) {
    getOrCreate('chart-top-frequency', {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Times Purchased',
          data: data.values,
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primaryBorder,
          borderWidth: 1
        }]
      },
      options: {
        ...baseOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => data.fullNames[items[0].dataIndex] || items[0].label,
              label: (ctx) => `Purchased ${ctx.parsed.x} time(s)`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: getTextColor() },
            grid: { color: getGridColor() },
            beginAtZero: true
          },
          y: {
            ticks: { color: getTextColor(), font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* ---- Top Spend (horizontal bar) ---- */

  function renderTopSpend(data) {
    getOrCreate('chart-top-spend', {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Total Spent',
          data: data.values,
          backgroundColor: COLORS.success,
          borderColor: COLORS.successBorder,
          borderWidth: 1
        }]
      },
      options: {
        ...baseOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => data.fullNames[items[0].dataIndex] || items[0].label,
              label: (ctx) => `$${ctx.parsed.x.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: getTextColor(),
              callback: (v) => '$' + v
            },
            grid: { color: getGridColor() },
            beginAtZero: true
          },
          y: {
            ticks: { color: getTextColor(), font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* ---- Savings Breakdown (doughnut) ---- */

  function renderSavingsBreakdown(data) {
    if (data.labels.length === 0) {
      const el = document.getElementById('chart-savings-breakdown');
      if (el && el.parentElement) {
        el.parentElement.innerHTML = '<p>No savings data found in the uploaded file.</p>';
      }
      return;
    }

    getOrCreate('chart-savings-breakdown', {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: [COLORS.success, COLORS.primary, COLORS.warning, COLORS.purple],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: getTextColor(), padding: 16, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`
            }
          }
        }
      }
    });
  }

  /* ---- Monthly Savings Trend (bar) ---- */

  function renderMonthlySavings(data) {
    getOrCreate('chart-monthly-savings', {
      type: 'bar',
      data: {
        labels: data.labels.map(formatMonthLabel),
        datasets: [{
          label: 'Savings',
          data: data.values,
          backgroundColor: COLORS.success,
          borderColor: COLORS.successBorder,
          borderWidth: 1
        }]
      },
      options: {
        ...baseOptions(),
        plugins: {
          legend: { display: false },
          tooltip: dollarTooltip()
        },
        scales: {
          x: {
            ticks: { color: getTextColor() },
            grid: { color: getGridColor() }
          },
          y: {
            ticks: {
              color: getTextColor(),
              callback: (v) => '$' + v
            },
            grid: { color: getGridColor() },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ---- Render All ---- */

  function renderAll(metrics) {
    renderMonthlySpending(metrics.monthly);
    renderDepartment(metrics.departments);
    renderBasketSize(metrics.basketSize);
    renderTopFrequency(metrics.topFrequency);
    renderTopSpend(metrics.topSpend);
    renderSavingsBreakdown(metrics.savingsBreakdown);
    renderMonthlySavings(metrics.monthlySavings);
  }

  function destroyAll() {
    Object.keys(chartInstances).forEach(id => {
      if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
      }
    });
  }

  /* ---- Helpers ---- */

  function formatMonthLabel(key) {
    if (!key) return '';
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m) - 1] + ' ' + y;
  }

  return { renderAll, destroyAll };
})();
