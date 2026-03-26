// dashboard.js - renders usage charts and managed sites overview

const summaryCards = document.getElementById("summaryCards");
const managedSitesList = document.getElementById("managedSitesList");
const exportBtn = document.getElementById("exportBtn");

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function formatMinutes(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function shortDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// Site colors for charts
const SITE_COLORS = [
  "#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa",
  "#a78bfa", "#fb923c", "#2dd4bf", "#f87171", "#a3e635"
];

async function loadData() {
  const result = await chrome.storage.local.get(["managedSites", "usageLog"]);
  const sites = (result.managedSites || []).filter(s => s.enabled);
  const log = result.usageLog || {};
  return { sites, log };
}

async function renderSummaryCards(sites, log) {
  const today = todayKey();
  const todayLog = log[today] || {};

  let totalToday = 0;
  let sitesOverLimit = 0;

  for (const site of sites) {
    const usage = todayLog[site.domain] || { totalSeconds: 0 };
    totalToday += usage.totalSeconds;
    if (usage.totalSeconds >= site.dailyLimitMinutes * 60) {
      sitesOverLimit++;
    }
  }

  // Weekly total
  const last7 = getLast7Days();
  let weeklyTotal = 0;
  for (const day of last7) {
    const dayLog = log[day] || {};
    for (const site of sites) {
      weeklyTotal += (dayLog[site.domain] || { totalSeconds: 0 }).totalSeconds;
    }
  }

  summaryCards.innerHTML = `
    <div class="summary-card">
      <div class="value">${formatMinutes(totalToday)}</div>
      <div class="label">Total usage today</div>
    </div>
    <div class="summary-card">
      <div class="value">${sites.length}</div>
      <div class="label">Sites tracked</div>
    </div>
    <div class="summary-card">
      <div class="value">${sitesOverLimit}</div>
      <div class="label">Over limit today</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatMinutes(weeklyTotal)}</div>
      <div class="label">Total this week</div>
    </div>
  `;
}

async function renderWeeklyChart(sites, log) {
  const last7 = getLast7Days();
  const labels = last7.map(shortDay);

  const datasets = sites.map((site, i) => {
    const data = last7.map(day => {
      const dayLog = log[day] || {};
      const usage = dayLog[site.domain] || { totalSeconds: 0 };
      return Math.round(usage.totalSeconds / 60); // minutes
    });

    return {
      label: site.domain,
      data,
      backgroundColor: SITE_COLORS[i % SITE_COLORS.length],
      borderRadius: 4
    };
  });

  new Chart(document.getElementById("weeklyChart"), {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { size: 12 } }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#64748b" },
          grid: { color: "#1e293b" }
        },
        y: {
          stacked: true,
          ticks: {
            color: "#64748b",
            callback: (v) => v + "m"
          },
          grid: { color: "#1e293b" },
          title: {
            display: true,
            text: "Minutes",
            color: "#64748b"
          }
        }
      }
    }
  });
}

async function renderSiteChart(sites, log) {
  const today = todayKey();
  const todayLog = log[today] || {};

  const labels = [];
  const data = [];
  const colors = [];

  sites.forEach((site, i) => {
    const usage = todayLog[site.domain] || { totalSeconds: 0 };
    if (usage.totalSeconds > 0) {
      labels.push(site.domain);
      data.push(Math.round(usage.totalSeconds / 60));
      colors.push(SITE_COLORS[i % SITE_COLORS.length]);
    }
  });

  if (data.length === 0) {
    document.getElementById("siteChart").parentElement.innerHTML =
      '<p class="empty-msg">No usage data for today yet.</p>';
    return;
  }

  new Chart(document.getElementById("siteChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: "#0f172a",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#94a3b8", font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed}m`
          }
        }
      }
    }
  });
}

async function removeSite(domainToRemove) {
  // Load the full managedSites array (not just enabled ones) to avoid
  // accidentally deleting disabled sites alongside the target
  const result = await chrome.storage.local.get("managedSites");
  const allSites = result.managedSites || [];
  const updated = allSites.filter(s => s.domain !== domainToRemove);
  await chrome.storage.local.set({ managedSites: updated });

  // Re-render with fresh data
  const { sites, log } = await loadData();
  renderSummaryCards(sites, log);
  renderManagedSites(sites);
}

function renderManagedSites(sites) {
  if (sites.length === 0) {
    managedSitesList.innerHTML = '<p class="empty-msg">No managed sites. Add sites from the extension popup.</p>';
    return;
  }

  managedSitesList.innerHTML = sites.map(site => `
      <div class="site-row">
        <div class="site-row-info">
          <div class="domain">${site.domain}</div>
          <div class="details">
            Limit: <input type="number" class="limit-input" data-domain="${site.domain}" value="${site.dailyLimitMinutes}" min="1"> min/day 
          </div>
        </div>
        <div class="site-row-actions">
          <span class="mode-badge ${site.blockMode}">${site.blockMode}</span>
          
          <button class="save-limit-btn" data-domain="${site.domain}">Save</button>
          
          <button class="remove-btn" data-domain="${site.domain}">Remove</button>
        </div>
      </div>
    `).join("");

  managedSitesList.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const domain = e.currentTarget.dataset.domain;
      if (confirm(`Remove "${domain}" from managed sites?`)) {
        await removeSite(domain);
      }
    });
  });

  managedSitesList.querySelectorAll(".save-limit-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const domain = e.currentTarget.dataset.domain;
      const input = managedSitesList.querySelector(`.limit-input[data-domain="${domain}"]`);
      const newLimit = parseInt(input.value);

      if (newLimit > 0) {
        await updateSiteLimit(domain, newLimit);
        alert(`Limit updated for ${domain}`);
      }
    });
  });
}

async function updateSiteLimit(domain, newLimit) {
  // 1. Get the current list from storage
  const result = await chrome.storage.local.get("managedSites");
  const allSites = result.managedSites || [];

  // 2. Create a new array with the updated limit for that specific domain
  const updatedSites = allSites.map(site => {
    if (site.domain === domain) {
      return { ...site, dailyLimitMinutes: newLimit };
    }
    return site;
  });

  // 3. Save it back to storage
  await chrome.storage.local.set({ managedSites: updatedSites });

  // 4. Refresh the UI stats (like "Sites over limit") immediately
  const { sites, log } = await loadData();
  renderSummaryCards(sites, log);
}

function setupExport(sites, log) {
  exportBtn.addEventListener("click", () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      managedSites: sites,
      usageLog: log
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refocus-data-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function init() {
  const { sites, log } = await loadData();
  renderSummaryCards(sites, log);
  renderWeeklyChart(sites, log);
  renderSiteChart(sites, log);
  renderManagedSites(sites);
  setupExport(sites, log);
}

init();