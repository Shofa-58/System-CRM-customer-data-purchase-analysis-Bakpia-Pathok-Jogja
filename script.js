/**
 * script.js
 * Dashboard Analisis Pelanggan – Bakpia Pathok Oleh-Oleh Jogja
 *
 * Modul:
 *  1. State & konstanta
 *  2. loadData()
 *  3. init()
 *  4. buildFilters()
 *  5. applyFilter()
 *  6. renderKPI()
 *  7. renderBestProducts()   – horizontal bar chart
 *  8. renderCustomerType()   – donut chart
 *  9. renderMonthlyTrend()   – line chart
 * 10. renderTopCustomers()   – tabel top 10
 * 11. Helpers
 */

'use strict';

/* ================================================================
   1. STATE & KONSTANTA
================================================================ */

const C = {
  brown:   '#5C3317',
  terra:   '#B8481F',
  terraLt: '#D4652F',
  green:   '#3D7A5A',
  blue:    '#3B6FA0',
  muted:   '#9A6B4B',
  cream:   '#F4E4C1',
  // Palet warna untuk bar & pie
  palette: ['#5C3317','#B8481F','#7A4828','#3D7A5A','#D4652F','#3B6FA0',
            '#9A6B4B','#6B5B3E','#C47A3A','#4A7C6A','#A0522D','#5F7A8A'],
};

/** Instance Chart.js aktif */
const charts = { bestProducts: null, customerType: null, monthlyTrend: null };

/** Data mentah dari JSON */
let rawData = null;

/** Kategori aktif; 'all' = semua */
let activeCategory = 'all';

/* ── Chart.js global defaults: font & color ── */
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#9A6B4B';


/* ================================================================
   2. LOAD DATA
================================================================ */

async function loadData() {
  const res = await fetch('data/customers.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


/* ================================================================
   3. INIT
================================================================ */

async function init() {
  try {
    rawData = await loadData();

    // Tanggal di header
    document.getElementById('lastUpdated').textContent =
      new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    buildFilters();
    applyFilter();
  } catch (err) {
    console.error('Dashboard error:', err);
    document.querySelector('main').innerHTML =
      `<div class="text-center py-20 text-red-600 font-semibold text-sm">
        ⚠️ Gagal memuat data.<br>
        <span class="font-normal text-gray-500">${err.message}</span>
       </div>`;
  }
}


/* ================================================================
   4. BUILD FILTER BUTTONS
================================================================ */

function buildFilters() {
  const categories = ['all', ...new Set(rawData.products.map(p => p.category))];
  const container  = document.getElementById('categoryFilters');

  container.innerHTML = categories.map(cat => {
    const label    = cat === 'all' ? 'Semua' : cat;
    const isActive = cat === activeCategory;
    return `<button class="filter-btn${isActive ? ' active' : ''}"
      data-category="${cat}" aria-pressed="${isActive}">${label}</button>`;
  }).join('');

  // Delegasi event
  container.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    container.querySelectorAll('.filter-btn').forEach(b => {
      const on = b.dataset.category === activeCategory;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    applyFilter();
  });
}


/* ================================================================
   5. APPLY FILTER
================================================================ */

function applyFilter() {
  const { products, customers, transactions } = rawData;
  const productMap = new Map(products.map(p => [p.id, p]));

  const filtered = activeCategory === 'all'
    ? transactions
    : transactions.filter(t => {
        const p = productMap.get(t.productId);
        return p && p.category === activeCategory;
      });

  renderKPI(filtered, customers, productMap);
  renderBestProducts(filtered, productMap);
  renderCustomerType(filtered, customers);
  renderMonthlyTrend(filtered, productMap);
  renderTopCustomers(filtered, customers, productMap);
}


/* ================================================================
   6. KPI CARDS
================================================================ */

function renderKPI(transactions, customers, productMap) {
  const totalRevenue = transactions.reduce((s, t) => {
    const p = productMap.get(t.productId);
    return s + (p ? p.price * t.quantity : 0);
  }, 0);

  const activeIds      = new Set(transactions.map(t => t.customerId));
  const totalCustomers = activeCategory === 'all' ? customers.length : activeIds.size;
  const totalTx        = transactions.length;
  const avgTx          = totalTx > 0 ? Math.round(totalRevenue / totalTx) : 0;
  const catLabel       = activeCategory === 'all' ? 'Semua kategori' : `Kategori: ${activeCategory}`;

  set('kpiTotalCustomers',    totalCustomers.toLocaleString('id-ID'));
  set('kpiTotalCustomersSub', activeCategory === 'all' ? `${customers.length} terdaftar` : `${activeIds.size} aktif`);
  set('kpiTotalTransactions',    totalTx.toLocaleString('id-ID'));
  set('kpiTotalTransactionsSub', catLabel);
  set('kpiTotalRevenue',    formatRp(totalRevenue));
  set('kpiTotalRevenueSub', catLabel);
  set('kpiAvgTransaction',    formatRp(avgTx));
  set('kpiAvgTransactionSub', 'Per transaksi');
}


/* ================================================================
   7. PRODUK TERLARIS – Horizontal Bar Chart
================================================================ */

function renderBestProducts(transactions, productMap) {
  // Hitung unit per produk
  const units = {};
  transactions.forEach(t => {
    const p = productMap.get(t.productId);
    if (!p) return;
    units[p.name] = (units[p.name] || 0) + t.quantity;
  });

  // Urutkan descending, ambil top 12
  const sorted = Object.entries(units)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Nama pendek untuk label sumbu Y
  const labels = sorted.map(([name]) =>
    name.replace('Bakpia Pathok ', 'BP ').replace('Geplak Kelapa ', 'Geplak ')
        .replace('Wajik Kletik ', 'Wajik ').replace('Yangko ', 'Yangko ')
  );
  const values   = sorted.map(([, v]) => v);
  const bgColors = sorted.map((_, i) => C.palette[i % C.palette.length]);

  destroyChart('bestProducts');

  const ctx = document.getElementById('chartBestProducts').getContext('2d');
  charts.bestProducts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Unit Terjual',
        data: values,
        backgroundColor: bgColors,
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',            // ← HORIZONTAL
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => sorted[items[0].dataIndex][0], // nama lengkap
            label: item  => ` ${item.raw} unit`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F4E4C1' },
          ticks: { color: C.muted, font: { size: 10 } },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: { color: C.brown, font: { size: 10.5, weight: '500' } },
          border: { display: false },
        },
      },
    },
  });
}


/* ================================================================
   8. TIPE PELANGGAN – Donut Chart
================================================================ */

function renderCustomerType(transactions, customers) {
  // Hitung frekuensi transaksi per pelanggan (dalam filter)
  const freq = {};
  transactions.forEach(t => { freq[t.customerId] = (freq[t.customerId] || 0) + 1; });

  let repeatCount = 0, newCount = 0;
  Object.values(freq).forEach(n => n > 1 ? repeatCount++ : newCount++);

  const total     = repeatCount + newCount;
  const repeatPct = total > 0 ? Math.round((repeatCount / total) * 100) : 0;
  const newPct    = total > 0 ? 100 - repeatPct : 0;

  destroyChart('customerType');

  const ctx = document.getElementById('chartCustomerType').getContext('2d');
  charts.customerType = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Repeat', 'New'],
      datasets: [{
        data: [repeatCount, newCount],
        backgroundColor: [C.terra, C.green],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: item => {
              const pct = total > 0 ? Math.round((item.raw / total) * 100) : 0;
              return ` ${item.raw} pelanggan (${pct}%)`;
            },
          },
        },
      },
    },
    plugins: [{
      id: 'centerLabel',
      afterDraw(chart) {
        const { ctx: c, chartArea: { width, height, left, top } } = chart;
        const cx = left + width / 2;
        const cy = top  + height / 2;
        c.save();
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        c.font = `800 ${Math.round(width * 0.18)}px Inter, sans-serif`;
        c.fillStyle = C.brown;
        c.fillText(`${repeatPct}%`, cx, cy - 7);
        c.font = `500 ${Math.round(width * 0.1)}px Inter, sans-serif`;
        c.fillStyle = '#B0968A';
        c.fillText('repeat', cx, cy + Math.round(width * 0.12));
        c.restore();
      },
    }],
  });

  // Legenda custom
  document.getElementById('customerTypeLegend').innerHTML = `
    <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;font-weight:600;color:#5C3317">
      <span style="width:10px;height:10px;border-radius:50%;background:${C.terra};display:inline-block"></span>
      Repeat <b style="color:${C.terra}">${repeatPct}%</b>
    </span>
    <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;font-weight:600;color:#5C3317">
      <span style="width:10px;height:10px;border-radius:50%;background:${C.green};display:inline-block"></span>
      New <b style="color:${C.green}">${newPct}%</b>
    </span>`;
}


/* ================================================================
   9. TREN BULANAN – Line Chart
================================================================ */

function renderMonthlyTrend(transactions, productMap) {
  // Kumpulkan semua bulan dan hitung revenue + jumlah transaksi
  const monthSet = new Set(transactions.map(t => t.date.substring(0, 7)));
  const months   = Array.from(monthSet).sort();

  const rev   = {};
  const count = {};
  months.forEach(m => { rev[m] = 0; count[m] = 0; });

  transactions.forEach(t => {
    const m = t.date.substring(0, 7);
    const p = productMap.get(t.productId);
    if (!p) return;
    rev[m]   += p.price * t.quantity;
    count[m] += 1;
  });

  const labels     = months.map(m => monthLabel(m));
  const revenueArr = months.map(m => rev[m]);
  const countArr   = months.map(m => count[m]);

  destroyChart('monthlyTrend');

  const ctx = document.getElementById('chartMonthlyTrend').getContext('2d');
  charts.monthlyTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue (Rp)',
          data: revenueArr,
          yAxisID: 'yRev',
          borderColor: C.terra,
          backgroundColor: 'rgba(184,72,31,0.10)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: C.terra,
          borderWidth: 2,
        },
        {
          label: 'Jumlah Transaksi',
          data: countArr,
          yAxisID: 'yCount',
          borderColor: C.blue,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: C.blue,
          borderWidth: 1.5,
          borderDash: [4, 3],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11 }, color: C.muted },
        },
        tooltip: {
          callbacks: {
            label: item => item.datasetIndex === 0
              ? ` Revenue: ${formatRp(item.raw)}`
              : ` Transaksi: ${item.raw}x`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: C.brown, font: { size: 10 } },
          border: { display: false },
        },
        yRev: {
          position: 'left',
          beginAtZero: true,
          grid: { color: '#F4E4C1' },
          border: { display: false },
          ticks: {
            color: C.terra,
            font: { size: 10 },
            callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'k',
          },
        },
        yCount: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { color: C.blue, font: { size: 10 }, stepSize: 1 },
        },
      },
    },
  });
}


/* ================================================================
  10. TOP 10 PELANGGAN – Tabel
================================================================ */

function renderTopCustomers(transactions, customers, productMap) {
  const customerMap = new Map(customers.map(c => [c.id, c]));

  // Agregasi per pelanggan
  const stats = {};
  transactions.forEach(t => {
    const p = productMap.get(t.productId);
    if (!p) return;
    if (!stats[t.customerId]) stats[t.customerId] = { revenue: 0, txCount: 0 };
    stats[t.customerId].revenue  += p.price * t.quantity;
    stats[t.customerId].txCount  += 1;
  });

  // Top 10 berdasarkan revenue
  const top10 = Object.entries(stats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  const tbody = document.getElementById('topCustomersTable');

  if (!top10.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-3 py-8 text-center text-gray-400 text-xs">
      Tidak ada data untuk kategori ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = top10.map(([cid, s], i) => {
    const rank     = i + 1;
    const customer = customerMap.get(cid) || { name: 'Unknown' };
    const isRepeat = s.txCount > 1;
    const badgeHtml = isRepeat
      ? `<span class="badge badge-repeat">Repeat</span>`
      : `<span class="badge badge-new">New</span>`;

    let rankClass = 'rank-other';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';

    return `<tr>
      <td class="px-3 py-2"><span class="rank-medal ${rankClass}">${rank}</span></td>
      <td class="px-3 py-2">
        <div class="font-semibold text-gray-800 text-xs leading-tight">${esc(customer.name)}</div>
        <div class="text-2xs text-gray-400">${esc(customer.city || '')}</div>
      </td>
      <td class="px-3 py-2 text-right text-gray-500">${s.txCount}x</td>
      <td class="px-3 py-2 text-right">
        <div class="font-bold text-brown text-xs">${formatRp(s.revenue)}</div>
        <div class="flex justify-end mt-0.5">${badgeHtml}</div>
      </td>
    </tr>`;
  }).join('');
}


/* ================================================================
  11. HELPERS
================================================================ */

/** Format angka ke Rupiah: 1250000 → "Rp 1.250.000" */
function formatRp(n) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

/** "2024-03" → "Mar '24" */
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${names[+m - 1]} '${y.slice(2)}`;
}

/** Hapus instance chart sebelum rebuild */
function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

/** Escape HTML untuk innerHTML */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** Helper singkat untuk textContent */
function set(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}


/* ── Entry point ── */
document.addEventListener('DOMContentLoaded', init);
