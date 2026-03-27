// popup.js - extension popup showing usage stats, quick add, and virtual plant

const quickAddBtn = document.getElementById("quickAddBtn");
const quickAddStatus = document.getElementById("quickAddStatus");
const usageList = document.getElementById("usageList");
const plantEmoji = document.getElementById("plantEmoji");
const plantLabel = document.getElementById("plantLabel");
const dashboardLink = document.getElementById("dashboardLink");

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getProgressClass(percent) {
  if (percent >= 90) return "danger";
  if (percent >= 60) return "warning";
  return "safe";
}

async function getCurrentTabDomain() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.url) return null;
  try {
    return new URL(tabs[0].url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

async function loadUsage() {
  const result = await chrome.storage.local.get("managedSites");
  const sites = result.managedSites || [];

  if (sites.length === 0) {
    usageList.innerHTML = '<p class="empty-msg">No managed sites yet. Add one above!</p>';
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const logResult = await chrome.storage.local.get("usageLog");
  const log = logResult.usageLog || {};

  let html = "";
  for (const site of sites) {
    if (!site.enabled) continue;

    const usage = log?.[today]?.[site.domain] || { totalSeconds: 0 };
    const limitSeconds = site.dailyLimitMinutes * 60;
    const percent = Math.min(100, Math.round((usage.totalSeconds / limitSeconds) * 100));
    const progressClass = getProgressClass(percent);

    const timeUsed = formatTime(usage.totalSeconds);
    const timeLimit = formatTime(limitSeconds);

    html += `
      <div class="usage-card">
        <div class="usage-card-header">
          <span class="usage-domain">${site.domain}</span>
          <span class="usage-time">${timeUsed} / ${timeLimit}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${progressClass}" style="width: ${percent}%"></div>
        </div>
        <div class="usage-status">${percent}% of daily limit used</div>
      </div>
    `;
  }

  usageList.innerHTML = html || '<p class="empty-msg">No enabled sites.</p>';
}

async function setupQuickAdd() {
  const domain = await getCurrentTabDomain();
  if (!domain || domain.startsWith("chrome") || domain.startsWith("edge")) {
    quickAddBtn.disabled = true;
    quickAddStatus.textContent = "Navigate to a site to add it";
    return;
  }

  // Check if already managed
  const result = await chrome.storage.local.get("managedSites");
  const sites = result.managedSites || [];
  const alreadyManaged = sites.find(s => s.domain === domain);

  if (alreadyManaged) {
    quickAddBtn.disabled = true;
    quickAddStatus.textContent = `${domain} is already managed`;
    return;
  }

  quickAddStatus.textContent = `Add ${domain} to managed sites`;

  quickAddBtn.addEventListener("click", async () => {
    const newSite = {
      domain,
      dailyLimitMinutes: 30,
      blockMode: "hard",
      blockedSubPaths: [],
      enabled: true,
      dateAdded: new Date().toISOString().split("T")[0]
    };

    const current = await chrome.storage.local.get("managedSites");
    const currentSites = current.managedSites || [];
    currentSites.push(newSite);
    await chrome.storage.local.set({ managedSites: currentSites });

    quickAddBtn.disabled = true;
    quickAddStatus.textContent = `Added ${domain}!`;

    await loadUsage();
  });
}

// Dashboard link opens the dashboard page
dashboardLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("/dashboard/dashboard.html") });
});

// Initialize popup
async function init() {
  await setupQuickAdd();
  await loadUsage();
}

init();
