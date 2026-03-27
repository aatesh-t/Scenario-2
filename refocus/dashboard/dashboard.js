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

async function removeSite(domainToRemove) {
  const result = await chrome.storage.local.get("managedSites");
  const allSites = result.managedSites || [];
  const updated = allSites.filter(s => s.domain !== domainToRemove);
  await chrome.storage.local.set({ managedSites: updated });
  const { sites, log } = await loadData();
  renderSummaryCards(sites, log);
  renderManagedSites(sites);
}

async function updateSiteLimit(domain, newLimit) {
  const result = await chrome.storage.local.get("managedSites");
  const allSites = result.managedSites || [];
  const updatedSites = allSites.map(site => {
    if (site.domain === domain) {
      return { ...site, dailyLimitMinutes: newLimit };
    }
    return site;
  });

  await chrome.storage.local.set({ managedSites: updatedSites });
  const { sites, log } = await loadData();
  renderSummaryCards(sites, log);
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
  renderManagedSites(sites);
  setupExport(sites, log);
}

init();