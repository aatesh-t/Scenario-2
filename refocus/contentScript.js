const HOSTNAME = window.location.hostname.replace("www.", "");

async function getManagedSite() {
  return new Promise((resolve) => {
    chrome.storage.local.get("managedSites", (result) => {
      const sites = result.managedSites || [];
      const match = sites.find(
        (s) => s.enabled && HOSTNAME.includes(s.domain)
      );
      resolve(match || null);
    });
  });
}

function isSubPathBlocked(site, subPath) {
  return site.blockedSubPaths.some((p) => subPath.includes(p));
}

function createOverlay(message = "This content is blocked by ReFocus") {
  const host = document.createElement("div");

  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647"
  });

  const shadow = host.attachShadow({ mode: "closed" });

  shadow.innerHTML = `
    <style>
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;
        background: #0f172a;
        font-family: sans-serif;
      }
      .icon { font-size: 48px; }
      .title {
        font-size: 22px;
        font-weight: 600;
        color: #c7d2fe;
        margin: 0;
        text-align: center;
      }
      .subtitle {
        font-size: 14px;
        color: #94a3b8;
        margin: 0;
        text-align: center;
        max-width: 320px;
        line-height: 1.5;
      }
      .badge {
        margin-top: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: #6366f1;
        color: #fff;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.05em;
      }
    </style>
    <div class="overlay">
      <span class="icon">🔒</span>
      <p class="title">${message}</p>
      <p class="subtitle">
        You've chosen to block this content.<br>
        Stay focused — you've got this.
      </p>
      <span class="badge">ReFocus</span>
    </div>
  `;

  return host;
}

// Youtube Shorts blocking - uses a polling loop that checks the current URL every 500ms

let youtubeOverlay = null;
let lastYouTubeURL = "";

async function handleYouTubeNavigation() {
  const currentURL = window.location.href;

  // Only do work if the URL has actually changed
  if (currentURL === lastYouTubeURL) return;
  lastYouTubeURL = currentURL;

  const isShorts = window.location.pathname.startsWith("/shorts/");

  // Remove existing overlay whenever URL changes
  if (youtubeOverlay) {
    youtubeOverlay.remove();
    youtubeOverlay = null;
  }

  if (!isShorts) return;

  const site = await getManagedSite();
  if (!site) return;
  if (!isSubPathBlocked(site, "/shorts/")) return;

  youtubeOverlay = createOverlay("YouTube Shorts are blocked");
  document.body.appendChild(youtubeOverlay);
}

function initYouTube() {
  handleYouTubeNavigation();

  setInterval(handleYouTubeNavigation, 500);

  window.addEventListener("popstate", handleYouTubeNavigation);

  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    handleYouTubeNavigation();
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    handleYouTubeNavigation();
  };
}

// Instagram Reels blocking - URL is not changed when scrolling to reels
// so a MutationObserver detects when the Reels section appears in the DOM
let instagramObserver = null;
let lastInstagramURL  = "";

function findReelsSection() {
  const ariaMatch = document.querySelector('[aria-label="Reels"]');
  if (ariaMatch) return ariaMatch;

  const allElements = document.querySelectorAll("span, h2, h3");
  for (const el of allElements) {
    if (el.textContent.trim() === "Reels") {
      let ancestor = el.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!ancestor) break;
        if (
          ancestor.tagName === "SECTION" ||
          ancestor.tagName === "ARTICLE" ||
          ancestor.tagName === "MAIN" ||
          ancestor.offsetHeight > 200
        ) {
          return ancestor;
        }
        ancestor = ancestor.parentElement;
      }
      return el.parentElement;
    }
  }

  return null;
}

function overlayReelsSection(section) {
  if (section.dataset.refocusBlocked) return;
  section.dataset.refocusBlocked = "true";

  const originalPosition = section.style.position;
  if (!originalPosition || originalPosition === "static") {
    section.style.position = "relative";
  }

  const overlay = createOverlay("Instagram Reels are blocked");

  Object.assign(overlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%"
  });

  section.appendChild(overlay);
}

async function handleInstagramDOM() {
  const site = await getManagedSite();
  if (!site) return;
  if (!isSubPathBlocked(site, "/reels/")) return;

  const reelsSection = findReelsSection();
  if (reelsSection) {
    overlayReelsSection(reelsSection);
  }
}

async function handleInstagramNavigation() {
  const currentURL = window.location.href;
  if (currentURL === lastInstagramURL) return;
  lastInstagramURL = currentURL;

  // When the URL itself contains /reels/, cover the full screen
  if (window.location.pathname.startsWith("/reels/")) {
    const site = await getManagedSite();
    if (!site) return;
    if (!isSubPathBlocked(site, "/reels/")) return;

    const existing = document.getElementById("refocus-ig-overlay");
    if (!existing) {
      const overlay = createOverlay("Instagram Reels are blocked");
      overlay.id = "refocus-ig-overlay";
      document.body.appendChild(overlay);
    }
  } else {
    // Remove the full-page overlay if the user navigated away from /reels/
    const existing = document.getElementById("refocus-ig-overlay");
    if (existing) existing.remove();
  }
}

function initInstagram() {
  handleInstagramDOM();
  handleInstagramNavigation();

  // Poll for URL changes 
  setInterval(handleInstagramNavigation, 500);

  // MutationObserver watches for reels sections appearing in the DOM
  instagramObserver = new MutationObserver(() => {
    handleInstagramDOM();
  });

  instagramObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Entry point
(function init() {
  console.log("ReFocus content script loaded on:", HOSTNAME);

  if (HOSTNAME.includes("youtube.com")) {
    initYouTube();
  } else if (HOSTNAME.includes("instagram.com")) {
    initInstagram();
  }
})();