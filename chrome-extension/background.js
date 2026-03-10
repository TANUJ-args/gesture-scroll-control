// background.js — Service worker for Gesture Scroll Control extension

let cameraWindowId = null;
let scrollSpeed = 40;
let scrollCooldown = 50;
let pdfAuto = true;
let running = false;
let lastScrollTime = 0;
let lastActiveTabId = null;

// ---- Camera window management ----

async function rememberActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && !tab.url?.startsWith("chrome-extension://")) {
      lastActiveTabId = tab.id;
    }
  } catch (_) {}
}

async function start() {
  await rememberActiveTab();
  running = true;
  chrome.storage.local.set({ running: true });

  // Close old camera window if any
  if (cameraWindowId) {
    try { await chrome.windows.remove(cameraWindowId); } catch (_) {}
    cameraWindowId = null;
  }

  // Open small camera window
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("camera.html"),
    type: "popup",
    width: 360,
    height: 340,
    top: 50,
    left: 50,
    focused: false,
  });
  cameraWindowId = win.id;
}

async function stop() {
  running = false;
  chrome.storage.local.set({ running: false });
  if (cameraWindowId) {
    try { await chrome.windows.remove(cameraWindowId); } catch (_) {}
    cameraWindowId = null;
  }
}

// ---- Scroll the target tab ----

async function scrollTargetTab(direction) {
  const now = Date.now();
  if (now - lastScrollTime < scrollCooldown) return;
  lastScrollTime = now;

  try {
    // Try the remembered tab first
    let tabId = lastActiveTabId;

    // If that's gone, find the current active non-extension tab
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs.find(t => !t.url?.startsWith("chrome-extension://"));
      if (tab) tabId = tab.id;
    }
    if (!tabId) {
      // Fallback: any active tab in any window
      const tabs = await chrome.tabs.query({ active: true });
      const tab = tabs.find(t => !t.url?.startsWith("chrome-extension://"));
      if (tab) tabId = tab.id;
    }

    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, {
      type: "scroll",
      direction,
      amount: scrollSpeed,
    }).catch(() => {});
  } catch (_) {
    // Tab may not be scriptable
  }
}

// ---- Messages from popup & offscreen ----

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === "start") start();
  if (msg.type === "stop") stop();

  if (msg.type === "settings") {
    if (msg.scrollSpeed !== undefined) scrollSpeed = msg.scrollSpeed;
    if (msg.scrollCooldown !== undefined) scrollCooldown = msg.scrollCooldown;
    if (msg.pdfAuto !== undefined) pdfAuto = msg.pdfAuto;
  }

  if (msg.type === "gesture" && running) {
    // Forward to popup for display
    chrome.runtime.sendMessage({ type: "gesture", gesture: msg.gesture }).catch(() => {});

    if (msg.gesture === "scroll_up") {
      scrollTargetTab("up");
    } else if (msg.gesture === "scroll_down") {
      scrollTargetTab("down");
    }
  }

  if (msg.type === "camera-closed" && running) {
    running = false;
    cameraWindowId = null;
    chrome.storage.local.set({ running: false });
    chrome.runtime.sendMessage({ type: "stopped" }).catch(() => {});
  }
});

// Track when camera window is closed manually
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === cameraWindowId) {
    cameraWindowId = null;
    if (running) {
      running = false;
      chrome.storage.local.set({ running: false });
      chrome.runtime.sendMessage({ type: "stopped" }).catch(() => {});
    }
  }
});

// Track active tab changes so we always scroll the right page
chrome.tabs.onActivated.addListener(async (info) => {
  try {
    const tab = await chrome.tabs.get(info.tabId);
    if (tab && !tab.url?.startsWith("chrome-extension://")) {
      lastActiveTabId = info.tabId;
    }
  } catch (_) {}
});

// ---- Auto-activate on PDF tabs ----

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!pdfAuto || running) return;
  if (changeInfo.status !== "complete") return;
  const url = tab.url || "";
  if (url.endsWith(".pdf") || url.includes("type=application/pdf") || url.includes("/pdf/")) {
    start();
  }
});

// ---- Restore settings on startup ----

chrome.storage.local.get(
  { scrollSpeed: 40, scrollCooldown: 50, pdfAuto: true, running: false },
  (data) => {
    scrollSpeed = data.scrollSpeed;
    scrollCooldown = data.scrollCooldown;
    pdfAuto = data.pdfAuto;
    // Don't auto-resume running on startup (camera permission needs user gesture)
  }
);
