// background.js
// background service worker for the extension
// detecting which website is being used, tracking time used, checking if time limit is exceeded, triggering block when limit is exceeded

import { addManagedSite, getManagedSites, getUsage, saveUsage, saveManagedSites, isBlocked, setBlocked } from "./storage.js";

// TEMPORARY TEST - hardcoded "youtube.com" with a 1 min limit - delete after testing
async function test() {
  await addManagedSite("youtube.com");
  const sites = await getManagedSites();
  sites[0].dailyLimitMinutes = 1;
  await saveManagedSites(sites);
  console.log("youtube.com added with 1 min limit for testing");
}
test();

let activeDomain = null;
const tempAllow = {};

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

// block a domain
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

// switching tab
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

// set-up alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tick", { periodInMinutes: 0.5 });
  console.log("ReFocus installed, tick alarm created");
});

// on every tick, add active time
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;
  if (!activeDomain) return;

  // check if active domain is in managed list
  const sites = await getManagedSites();
  const managedSite = sites.find(s => activeDomain.includes(s.domain) && s.enabled);
  if (!managedSite) return;

  // add 30 seconds to today's usage
  const usage = await getUsage(managedSite.domain);
  usage.totalSeconds += 30;
  await saveUsage(managedSite.domain, usage);

  console.log(`${managedSite.domain} - total today: ${usage.totalSeconds}s / ${managedSite.dailyLimitMinutes * 60}s`);

  // check if limit is exceeded
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