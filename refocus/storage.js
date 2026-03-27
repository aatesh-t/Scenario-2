export function todayKey() {
    return new Date().toISOString().split("T")[0];
}

export function createManagedSite(domain) {
    return {
        domain,
        dailyLimitMinutes: 30,
        blockMode: "hard",
        blockedSubPaths: [],
        enabled: true,
        dateAdded: todayKey()
    }
}

export async function getManagedSites() {
    const result = await chrome.storage.local.get("managedSites");
    return result.managedSites || []
}

export async function saveManagedSites(sites) {
    await chrome.storage.local.set({ managedSites: sites });
}

export async function addManagedSite(domain) {
    const sites = await getManagedSites();
    const already = sites.find(s => s.domain === domain);
    if (already) return;
    sites.push(createManagedSite(domain));
    await saveManagedSites(sites);
}

export async function getUsage(domain) {
    const today = todayKey();
    const result = await chrome.storage.local.get("usageLog");
    const log = result.usageLog || {};
    return log?.[today]?.[domain] || {
        totalSeconds: 0,
        overrideCount: 0
    };
}

export async function saveUsage(domain, usageData) {
    const today = todayKey();
    const result = await chrome.storage.local.get("usageLog");
    const log = result.usageLog || {};
    if (!log[today]) log[today] = {};
    log[today][domain] = usageData;
    await chrome.storage.local.set({ usageLog: log });
}

export async function getFullUsageLog() {
    const result = await chrome.storage.local.get("usageLog");
    return result.usageLog || {};
}

export async function isBlocked(domain) {
  const result = await chrome.storage.local.get("blockedSites");
  const blocked = result.blockedSites || [];
  return blocked.includes(domain);
}

export async function setBlocked(domain, value = true) {
  const result = await chrome.storage.local.get("blockedSites");
  let blocked = result.blockedSites || [];
  if (value) {
    if (!blocked.includes(domain)) {
      blocked.push(domain);
    }
  } else {
    blocked = blocked.filter(d => d !== domain);
  }
  await chrome.storage.local.set({ blockedSites: blocked });
}

export async function getPlantGrowth() {
  const result = await chrome.storage.local.get("plantGrowth");
  return result.plantGrowth || 0;
}

export async function savePlantGrowth(value) {
  await chrome.storage.local.set({ plantGrowth: value });
}