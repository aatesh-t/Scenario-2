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
      :host-context(body) {}

      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 12px;

        background: #0f172a;       /* matches blocked.css */
        font-family: sans-serif;
      }

      .icon {
        font-size: 48px;
      }

      .title {
        font-size: 22px;
        font-weight: 600;
        color: #c7d2fe;            /* soft accent — matches blocked.css h1 */
        margin: 0;
        text-align: center;
      }

      .subtitle {
        font-size: 14px;
        color: #94a3b8;            /* matches blocked.css p */
        margin: 0;
        text-align: center;
        max-width: 320px;
        line-height: 1.5;
      }

      .badge {
        margin-top: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: #6366f1;       /* matches blocked.css button */
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


let youtubeOverlay = null;

async function handleYouTubeNavigation() {
  const isShorts = window.location.pathname.startsWith("/shorts/");
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
  window.addEventListener("popstate", handleYouTubeNavigation);
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    handleYouTubeNavigation();
  };
}

let instagramObserver = null;
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

function initInstagram() {

  handleInstagramDOM();
  instagramObserver = new MutationObserver(() => {
    handleInstagramDOM();
  });

  instagramObserver.observe(document.body, {
    childList: true,  
    subtree: true     
  });
}
(function init() {
  console.log("ReFocus content script loaded on:", HOSTNAME);

  if (HOSTNAME.includes("youtube.com")) {
    initYouTube();
  } else if (HOSTNAME.includes("instagram.com")) {
    initInstagram();
  }
})();