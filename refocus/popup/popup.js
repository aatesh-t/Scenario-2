// popup.js - extension popup showing usage stats, quick add, and virtual plant

const quickAddBtn = document.getElementById("quickAddBtn");
const quickAddStatus = document.getElementById("quickAddStatus");
const usageList = document.getElementById("usageList");
const plantEmoji = document.getElementById("plantEmoji");
const plantLabel = document.getElementById("plantLabel");
const dashboardLink = document.getElementById("dashboardLink");

// Plant growth stages
const PLANT_STAGES = [
  { emoji: "\uD83C\uDF31", label: "Seed - just getting started!" },       // index 0
  { emoji: "\uD83C\uDF3F", label: "Sprout - growing nicely!" },           // index 1
  { emoji: "\uD83E\uDEB4", label: "Small plant - keep it up!" },          // index 2
  { emoji: "\uD83C\uDF33", label: "Strong tree - amazing progress!" },    // index 3
  { emoji: "\uD83C\uDF38", label: "In full bloom - you're thriving!" }    // index 4
];

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

async function loadPlant() {
  // Calculate compliance: how many enabled sites are under their limit
  const result = await chrome.storage.local.get(["managedSites", "usageLog", "plantGrowth"]);
  const sites = result.managedSites || [];
  const log = result.usageLog || {};
  let plantGrowth = result.plantGrowth || 0;

  const today = new Date().toISOString().split("T")[0];
  const enabledSites = sites.filter(s => s.enabled);

  if (enabledSites.length > 0) {
    const underLimit = enabledSites.filter(site => {
      const usage = log?.[today]?.[site.domain] || { totalSeconds: 0 };
      return usage.totalSeconds < site.dailyLimitMinutes * 60;
    });

    const complianceRate = underLimit.length / enabledSites.length;

    // Grow plant if all sites are under limit, otherwise pause
    if (complianceRate === 1 && plantGrowth < PLANT_STAGES.length - 1) {
      plantGrowth = Math.min(PLANT_STAGES.length - 1, plantGrowth + 1);
      await chrome.storage.local.set({ plantGrowth });
    }
  }

  const stage = PLANT_STAGES[Math.min(plantGrowth, PLANT_STAGES.length - 1)];
  plantEmoji.textContent = stage.emoji;
  plantLabel.textContent = stage.label;
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
    // Create a new managed site object
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

    // Refresh usage display
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
  await loadPlant();
}

init();
