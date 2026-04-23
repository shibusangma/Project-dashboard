/* ============================================================
   dashboard.js — Country Delight 3D Dashboard Logic
   ============================================================ */

let DATA = null;

// ─── HELPERS ─────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}
function fmtNum(n) {
  if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(2) + 'L';
  return n.toLocaleString('en-IN');
}
function animateCounter(el, target, prefix = '', suffix = '') {
  const duration = 1500;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(target * eased);
    el.textContent = prefix + val.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ─── COLORS ──────────────────────────────────────────────────
const COLORS = {
  bars: [
    '#00d4ff', '#7b2ff7', '#ff2d55', '#00e676', '#ff9f43',
    '#4f8cff', '#e040fb', '#ffeb3b', '#26c6da', '#ff6e40',
    '#ab47bc', '#66bb6a', '#42a5f5', '#ef5350', '#78909c'
  ],
  products: [
    '#00d4ff', '#7b2ff7', '#ff2d55', '#00e676', '#ff9f43',
    '#4f8cff', '#e040fb', '#26c6da', '#ff6e40', '#66bb6a'
  ],
  channels: ['#00d4ff', '#7b2ff7', '#ff2d55']
};

// ─── LOAD DATA ───────────────────────────────────────────────
async function loadData() {
  const resp = await fetch('dashboard_data.json');
  DATA = await resp.json();
  initDashboard();
}

// ─── INIT DASHBOARD ──────────────────────────────────────────
function initDashboard() {
  renderKPIs();
  init3DBarChart();
  renderProductDonut();
  renderBrandChart();
  renderChannelPie();
  renderTrendLine();
  renderGauge();
  renderInventoryTable();
  renderHeatmap();
  renderYearlyChart();
  renderStorageChart();

  // Hide loader
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    // Trigger animations
    document.querySelectorAll('.animate-in').forEach((el, i) => {
      el.style.animationDelay = (i * 0.08) + 's';
    });
  }, 600);
}

// ─── KPIs ────────────────────────────────────────────────────
function renderKPIs() {
  const s = DATA.summary;
  const kpis = [
    { id: 'kpi-revenue', value: s.totalRevenue, prefix: '₹', suffix: '', isDynamic: true },
    { id: 'kpi-sold', value: s.totalQuantitySold },
    { id: 'kpi-products', value: s.totalProducts },
    { id: 'kpi-brands', value: s.totalBrands },
    { id: 'kpi-states', value: s.totalStates },
    { id: 'kpi-alerts', value: s.belowThresholdCount }
  ];
  kpis.forEach(k => {
    const el = document.getElementById(k.id);
    if (el) animateCounter(el, k.value, k.prefix || '', k.suffix || '');
  });
}

// ─── 3D BAR CHART (Three.js) ─────────────────────────────────
function init3DBarChart() {
  const container = document.getElementById('revenue-3d');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(18, 14, 18);
  camera.lookAt(0, 2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
  const pointLight = new THREE.PointLight(0x00d4ff, 0.4, 50);
  pointLight.position.set(-5, 15, 5);
  scene.add(pointLight);

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(30, 30);
  const groundMat = new THREE.MeshPhongMaterial({
    color: 0x0a0e27, transparent: true, opacity: 0.5
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(28, 28, 0x1a2040, 0x111830);
  scene.add(grid);

  // Bars
  const states = DATA.revenueByState;
  const maxVal = states[0].value;
  const barWidth = 1.2;
  const gap = 0.5;
  const totalWidth = states.length * (barWidth + gap) - gap;
  const startX = -totalWidth / 2;

  const bars = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  states.forEach((s, i) => {
    const h = (s.value / maxVal) * 10;
    const geo = new THREE.BoxGeometry(barWidth, h, barWidth);
    const color = new THREE.Color(COLORS.bars[i % COLORS.bars.length]);
    const mat = new THREE.MeshPhongMaterial({
      color, emissive: color, emissiveIntensity: 0.15,
      transparent: true, opacity: 0.88
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(startX + i * (barWidth + gap), h / 2, 0);
    mesh.userData = { name: s.name, value: s.value, index: i };
    mesh.scale.y = 0;
    scene.add(mesh);
    bars.push(mesh);

    // Edge glow
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edges);
  });

  // Animate bars in
  const startTime = performance.now();
  function animateBars() {
    const elapsed = (performance.now() - startTime) / 1000;
    bars.forEach((bar, i) => {
      const delay = i * 0.08;
      const progress = Math.min(Math.max((elapsed - delay) / 0.6, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      bar.scale.y = eased;
    });
    if (elapsed < 3) requestAnimationFrame(animateBars);
  }
  animateBars();

  // Tooltip
  const tooltip = document.getElementById('tooltip3d');
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(bars);
    if (hits.length > 0) {
      const d = hits[0].object.userData;
      tooltip.innerHTML = `<strong>${d.name}</strong><br>${fmt(d.value)}`;
      tooltip.style.opacity = '1';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 14) + 'px';
    } else {
      tooltip.style.opacity = '0';
    }
  });
  container.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  // Orbit controls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minDistance = 10;
  controls.maxDistance = 35;

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h2 = container.clientHeight;
    camera.aspect = w / h2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h2);
  });
  ro.observe(container);
}

// ─── PRODUCT DONUT ──────────────────────────────────────────
function renderProductDonut() {
  const ctx = document.getElementById('chart-product-donut');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: DATA.revenueByProduct.map(p => p.name),
      datasets: [{
        data: DATA.revenueByProduct.map(p => p.value),
        backgroundColor: COLORS.products,
        borderColor: 'rgba(6,8,15,0.8)',
        borderWidth: 2,
        hoverBorderColor: '#fff',
        hoverBorderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#8b95b0', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          borderColor: 'rgba(0,212,255,0.2)',
          borderWidth: 1,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: { label: (c) => ` ${c.label}: ${fmt(c.raw)}` }
        }
      }
    }
  });
}

// ─── BRAND HORIZONTAL BAR ───────────────────────────────────
function renderBrandChart() {
  const ctx = document.getElementById('chart-brand-bar');
  if (!ctx) return;
  const top = DATA.revenueByBrand.slice(0, 8);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(b => b.name),
      datasets: [{
        data: top.map(b => b.value),
        backgroundColor: top.map((_, i) => COLORS.bars[i]),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: { label: (c) => fmt(c.raw) }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6380', font: { family: 'Inter', size: 10 }, callback: v => fmtNum(v) }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#8b95b0', font: { family: 'Inter', size: 11, weight: '500' } }
        }
      }
    }
  });
}

// ─── CHANNEL PIE ─────────────────────────────────────────────
function renderChannelPie() {
  const ctx = document.getElementById('chart-channel-pie');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: DATA.revenueByChannel.map(c => c.name),
      datasets: [{
        data: DATA.revenueByChannel.map(c => c.value),
        backgroundColor: COLORS.channels,
        borderColor: 'rgba(6,8,15,0.8)',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b95b0', font: { family: 'Inter', size: 12 }, padding: 18, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1,
          callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)}` }
        }
      }
    }
  });
}

// ─── MONTHLY TREND ──────────────────────────────────────────
function renderTrendLine() {
  const ctx = document.getElementById('chart-trend-line');
  if (!ctx) return;
  const labels = DATA.monthlyTrend.map(m => m.month);
  const values = DATA.monthlyTrend.map(m => m.revenue);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#00d4ff',
        backgroundColor: (context) => {
          const c = context.chart.ctx;
          const g = c.createLinearGradient(0, 0, 0, 300);
          g.addColorStop(0, 'rgba(0,212,255,0.18)');
          g.addColorStop(1, 'rgba(0,212,255,0)');
          return g;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00d4ff',
        pointBorderColor: '#06080f',
        pointBorderWidth: 2,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1,
          callbacks: { label: c => fmt(c.raw) }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#5a6380', font: { family: 'Inter', size: 10 }, maxRotation: 45, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6380', font: { family: 'Inter', size: 10 }, callback: v => fmtNum(v) }
        }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

// ─── GAUGE (Inventory Health) ────────────────────────────────
function renderGauge() {
  const s = DATA.summary;
  const pct = s.belowThresholdPct;
  const healthyPct = 100 - pct;

  document.getElementById('gauge-below-val').textContent = s.belowThresholdCount.toLocaleString();
  document.getElementById('gauge-oos-val').textContent = s.outOfStockCount.toLocaleString();
  document.getElementById('gauge-pct-val').textContent = pct.toFixed(1) + '%';

  // Draw arc
  const svg = document.getElementById('gauge-svg');
  const arc = document.getElementById('gauge-arc');
  const arcBg = document.getElementById('gauge-arc-bg');
  const label = document.getElementById('gauge-label');

  const radius = 80;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference * (1 - pct / 100);

  arcBg.setAttribute('stroke-dasharray', circumference);
  arcBg.setAttribute('stroke-dashoffset', '0');

  arc.setAttribute('stroke-dasharray', circumference);
  arc.setAttribute('stroke-dashoffset', circumference);
  // Animate
  setTimeout(() => {
    arc.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)';
    arc.setAttribute('stroke-dashoffset', offset);
  }, 300);

  label.textContent = pct.toFixed(1) + '%';
}

// ─── INVENTORY TABLE ─────────────────────────────────────────
function renderInventoryTable() {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  DATA.inventoryAlerts.forEach((a, i) => {
    const stockPct = a.threshold > 0 ? Math.min((a.stock / a.threshold) * 100, 100) : 0;
    const isCritical = a.stock === 0;
    const barColor = isCritical ? '#ff2d55' : (stockPct < 30 ? '#ff9f43' : '#00e676');
    const badgeClass = isCritical ? 'badge--critical' : 'badge--warning';
    const badgeText = isCritical ? 'Out of Stock' : 'Low Stock';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text-primary);font-weight:500">${a.product}</td>
      <td>${a.brand}</td>
      <td>${a.location}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="stock-bar" style="width:60px">
            <div class="stock-bar__fill" style="width:${stockPct}%;background:${barColor}"></div>
          </div>
          <span>${a.stock}</span>
        </div>
      </td>
      <td>${a.threshold}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── HEATMAP ─────────────────────────────────────────────────
function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  if (!grid) return;
  const states = DATA.customerLocationRevenue;
  const maxVal = states[0].value;

  states.forEach(s => {
    const intensity = s.value / maxVal;
    const r = Math.round(0 + intensity * 0);
    const g = Math.round(30 + intensity * 182);
    const b = Math.round(60 + intensity * 195);
    const bg = `rgba(${r},${g},${b},${0.15 + intensity * 0.35})`;

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.style.background = bg;
    cell.innerHTML = `
      <div class="heatmap-cell__name">${s.name}</div>
      <div class="heatmap-cell__value">${fmt(s.value)}</div>
      <div class="heatmap-cell__sub">${((s.value / DATA.summary.totalRevenue) * 100).toFixed(1)}% share</div>
    `;
    grid.appendChild(cell);
  });
}

// ─── YEARLY CHART ────────────────────────────────────────────
function renderYearlyChart() {
  const ctx = document.getElementById('chart-yearly');
  if (!ctx) return;
  const sorted = [...DATA.revenueByYear].sort((a, b) => a.name.localeCompare(b.name));
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(y => y.name),
      datasets: [{
        data: sorted.map(y => y.value),
        backgroundColor: ['#00d4ff', '#7b2ff7', '#00e676', '#ff2d55'],
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          callbacks: { label: c => fmt(c.raw) }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b95b0', font: { family: 'Inter', size: 13, weight: '600' } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a6380', font: { size: 10 }, callback: v => fmtNum(v) } }
      }
    }
  });
}

// ─── STORAGE CONDITION CHART ─────────────────────────────────
function renderStorageChart() {
  const ctx = document.getElementById('chart-storage');
  if (!ctx) return;
  const labels = Object.keys(DATA.storageConditionCounts);
  const values = Object.values(DATA.storageConditionCounts);
  new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['rgba(0,212,255,0.5)', 'rgba(123,47,247,0.5)', 'rgba(0,230,118,0.5)', 'rgba(255,159,67,0.5)', 'rgba(255,45,85,0.5)'],
        borderColor: 'rgba(6,8,15,0.6)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#8b95b0', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(10,14,30,0.92)',
          callbacks: { label: c => ` ${c.label}: ${c.raw.toLocaleString()}` }
        }
      },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { display: false }
        }
      }
    }
  });
}

// ─── START ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadData);
