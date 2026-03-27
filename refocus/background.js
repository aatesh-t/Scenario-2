import { getManagedSites, getUsage, saveUsage, isBlocked, setBlocked } from "./storage.js";

let activeDomain = null;
const tempAllow = {};

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

// Block a domain
function enforceBlock(domain, tabId) {
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`/blocked/blocked.html?domain=${domain}`)
  });
  console.log(`${domain} is now blocked`);
}

function isTempAllowed(domain) {
  const expiry = tempAllow[domain];
  if (!expiry) return false;
  if (Date.now() > expiry) {
    delete tempAllow[domain];
    return false;
  }
  return true;
}

async function checkAndEnforceLimit(domain, tabId) {
  const sites = await getManagedSites();
  const managedSite = sites.find(s => domain.includes(s.domain) && s.enabled);
  
  if (!managedSite) return;

  const usage = await getUsage(managedSite.domain);
  const limitSeconds = managedSite.dailyLimitMinutes * 60;

  if (usage.totalSeconds >= limitSeconds && managedSite.blockMode === "hard") {
    if (!isTempAllowed(managedSite.domain)) {
      await setBlocked(managedSite.domain, true);
      enforceBlock(managedSite.domain, tabId);
    }
  } else {
    await setBlocked(managedSite.domain, false);
  }
}

// Switching tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  activeDomain = getDomain(tab.url);
  console.log("Active domain:", activeDomain);
  if (activeDomain && await isBlocked(activeDomain) && !isTempAllowed(activeDomain)){
    enforceBlock(activeDomain, activeInfo.tabId);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    activeDomain = getDomain(tab.url);
    console.log("Active domain updated:", activeDomain);
    if (activeDomain && await isBlocked(activeDomain) && !isTempAllowed(activeDomain)) {
      enforceBlock(activeDomain, tabId);
    }
  }
});

// Set-up alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tick", { periodInMinutes: 0.5 });
  console.log("ReFocus installed, tick alarm created");
});

// On every tick, add active time
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;
  if (!activeDomain) return;

  // Check if active domain is in managed list
  const sites = await getManagedSites();
  const managedSite = sites.find(s => activeDomain.includes(s.domain) && s.enabled);
  if (!managedSite) return;

  // Add 30 seconds to today's usage
  const usage = await getUsage(managedSite.domain);
  usage.totalSeconds += 30;
  await saveUsage(managedSite.domain, usage);

  console.log(`${managedSite.domain} - total today: ${usage.totalSeconds}s / ${managedSite.dailyLimitMinutes * 60}s`);

  // Check if limit is exceeded
  const limitSeconds = managedSite.dailyLimitMinutes * 60;
  if (usage.totalSeconds >= limitSeconds && managedSite.blockMode === "hard" && !isTempAllowed(activeDomain)) {
    await setBlocked(managedSite.domain, true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) enforceBlock(managedSite.domain, tabs[0].id);
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TEMP_ALLOW") {
    const expiry = Date.now() + msg.duration;
    tempAllow[msg.domain] = expiry;
    setBlocked(msg.domain, false);
    console.log(`Allowed ${msg.domain} for 5 minutes`);
  }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && changes.managedSites) {
    console.log("New limits detected. Syncing...");
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const currentDomain = getDomain(tab.url);
      if (currentDomain) {
        checkAndEnforceLimit(currentDomain, tab.id);
      }
    }
  }
});

