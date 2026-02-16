/**
 * app.js - Main application controller.
 *
 * Handles file upload, dashboard rendering, tab navigation, and dark mode.
 */
const CostcoApp = (() => {

  let currentMetrics = null;

  function init() {
    initThemeToggle();
    initFileUpload();
    initResetButton();
    initTabs();
  }

  /* ---- Theme Toggle ---- */

  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('costco-theme');
    if (saved === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      toggle.checked = true;
    }

    toggle.addEventListener('change', () => {
      if (toggle.checked) {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('costco-theme', 'dark');
      } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('costco-theme', 'light');
      }
      if (currentMetrics) {
        CostcoCharts.renderAll(currentMetrics);
      }
    });
  }

  /* ---- Tabs ---- */

  function initTabs() {
    const nav = document.getElementById('tab-nav');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      const targetId = btn.getAttribute('data-tab');
      if (!targetId) return;

      nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
    });
  }

  /* ---- File Upload ---- */

  function initFileUpload() {
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleFile(file) {
    const uploadSection = document.getElementById('upload-section');
    const dashboardSection = document.getElementById('dashboard-section');

    try {
      showLoading(true);

      const rows = await CostcoParser.parseFile(file);
      const validation = CostcoParser.validate(rows);

      if (!validation.valid) {
        showError(validation.message);
        showLoading(false);
        return;
      }

      currentMetrics = CostcoAnalytics.computeAll(rows);

      uploadSection.hidden = true;
      dashboardSection.hidden = false;

      document.getElementById('file-info-text').textContent =
        `${file.name} — ${rows.length} items loaded`;

      renderSummaryCards(currentMetrics.summary);
      CostcoCharts.renderAll(currentMetrics);
      renderFrequencyTable(currentMetrics.frequencyTable);
      renderPriceChangesTable(currentMetrics.priceChanges);
      renderReturnsTab(currentMetrics);
      renderTopDiscountsTable(currentMetrics.topDiscounts);
      renderInsights(currentMetrics.insights);

      showLoading(false);
    } catch (err) {
      showError(err.message);
      showLoading(false);
    }
  }

  /* ---- Reset ---- */

  function initResetButton() {
    document.getElementById('btn-reset').addEventListener('click', () => {
      currentMetrics = null;
      CostcoCharts.destroyAll();

      document.getElementById('upload-section').hidden = false;
      document.getElementById('dashboard-section').hidden = true;
      document.getElementById('file-input').value = '';
    });
  }

  /* ---- Summary Cards ---- */

  function renderSummaryCards(summary) {
    document.getElementById('stat-total-spent').textContent = formatDollar(summary.totalSpent);
    document.getElementById('stat-total-trips').textContent = summary.totalTrips;
    document.getElementById('stat-items-purchased').textContent = summary.totalItemsPurchased;
    document.getElementById('stat-items-returned').textContent = summary.totalItemsReturned;
    document.getElementById('stat-total-savings').textContent = formatDollar(summary.totalSavings);
    document.getElementById('stat-avg-per-trip').textContent = formatDollar(summary.avgPerTrip);
  }

  /* ---- Frequency Table ---- */

  function renderFrequencyTable(data) {
    const container = document.getElementById('table-frequency');
    if (data.length === 0) {
      container.innerHTML = '<p>No purchase data.</p>';
      return;
    }

    const rows = data.slice(0, 50).map(item => `
      <tr>
        <td>${escHtml(item.name)}</td>
        <td>${item.count}</td>
        <td>${formatDollar(item.totalSpent)}</td>
        <td>${formatDate(item.firstDate)}</td>
        <td>${formatDate(item.lastDate)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Times Bought</th>
            <th>Total Spent</th>
            <th>First Purchase</th>
            <th>Last Purchase</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ---- Price Changes Table ---- */

  function renderPriceChangesTable(data) {
    const container = document.getElementById('table-price-changes');
    if (data.length === 0) {
      container.innerHTML = '<p>No price changes detected across your purchase history.</p>';
      return;
    }

    const rows = data.map(item => {
      const cls = item.change > 0 ? 'price-up' : 'price-down';
      const arrow = item.change > 0 ? '&#9650;' : '&#9660;';
      return `
        <tr>
          <td>${escHtml(item.name)}</td>
          <td>${formatDollar(item.oldPrice)}</td>
          <td>${formatDollar(item.newPrice)}</td>
          <td class="${cls}">${arrow} ${item.change > 0 ? '+' : ''}${formatDollar(item.change)} (${item.changePercent > 0 ? '+' : ''}${item.changePercent}%)</td>
          <td>${formatDate(item.firstDate)} &rarr; ${formatDate(item.lastDate)}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Old Price</th>
            <th>New Price</th>
            <th>Change</th>
            <th>Period</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ---- Returns Tab ---- */

  function renderReturnsTab(metrics) {
    document.getElementById('stat-total-refund').textContent =
      formatDollar(metrics.summary.totalReturnAmount);

    const totalItems = metrics.summary.totalItemsPurchased + metrics.summary.totalItemsReturned;
    const rate = totalItems > 0
      ? (metrics.summary.totalItemsReturned / totalItems * 100).toFixed(1)
      : '0.0';
    document.getElementById('stat-return-rate').textContent = rate + '%';

    const container = document.getElementById('table-returns');
    const data = metrics.returnsTable;

    if (data.length === 0) {
      container.innerHTML = '<p>No returns found in your data.</p>';
      return;
    }

    const rows = data.map(item => `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${escHtml(item.name)}</td>
        <td>${item.quantity}</td>
        <td>${formatDollar(item.refund)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Refund</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ---- Top Discounts Table ---- */

  function renderTopDiscountsTable(data) {
    const container = document.getElementById('table-top-discounts');

    if (data.length === 0) {
      container.innerHTML = '<p>No discount data found.</p>';
      return;
    }

    const rows = data.map(item => `
      <tr>
        <td>${escHtml(item.name)}</td>
        <td>${formatDollar(item.unitPrice)}</td>
        <td>${formatDollar(item.savings)}</td>
        <td>${item.discountPct}%</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Unit Price</th>
            <th>Savings</th>
            <th>Discount %</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ---- Insights ---- */

  function renderInsights(insights) {
    const container = document.getElementById('insights-list');

    if (insights.length === 0) {
      container.innerHTML = '<p>Upload more data to get spending insights.</p>';
      return;
    }

    container.innerHTML = insights.map(insight => {
      const variant = insight.type === 'warning' ? 'warning'
        : insight.type === 'success' ? 'success' : '';
      const variantAttr = variant ? ` data-variant="${variant}"` : '';

      return `
        <div role="alert"${variantAttr} class="insight-card">
          <strong>${escHtml(insight.title)}</strong> &mdash; ${escHtml(insight.text)}
        </div>
      `;
    }).join('');
  }

  /* ---- UI Helpers ---- */

  function showLoading(show) {
    const uploadArea = document.getElementById('upload-area');
    if (show) {
      uploadArea.classList.add('loading');
    } else {
      uploadArea.classList.remove('loading');
    }
  }

  function showError(message) {
    const uploadArea = document.getElementById('upload-area');
    const existing = uploadArea.querySelector('.upload-error');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'upload-error';
    el.setAttribute('role', 'alert');
    el.setAttribute('data-variant', 'danger');
    el.textContent = message;
    uploadArea.appendChild(el);

    setTimeout(() => el.remove(), 8000);
  }

  function formatDollar(val) {
    if (val == null || isNaN(val)) return '$0.00';
    const abs = Math.abs(val);
    const formatted = '$' + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return val < 0 ? '-' + formatted : formatted;
  }

  function formatDate(date) {
    if (!date || !(date instanceof Date)) return '--';
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
