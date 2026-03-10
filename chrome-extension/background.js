// background.js — Service worker for Gesture Scroll Control extension

let offscreenCreated = false;
let scrollSpeed = 40;
let scrollCooldown = 50;
let pdfAuto = true;
let running = false;
let lastScrollTime = 0;

// ---- Offscreen document management ----

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Webcam access for hand gesture detection",
    });
    offscreenCreated = true;
  } catch (e) {
    // Already exists
    if (e.message?.includes("already exists")) {
      offscreenCreated = true;
    } else {
      console.error("Offscreen creation failed:", e);
    }
  }
}

async function closeOffscreen() {
  if (!offscreenCreated) return;
  try {
    await chrome.offscreen.closeDocument();
  } catch (_) {
    // ignore
  }
  offscreenCreated = false;
}

// ---- Start / Stop ----

async function start() {
  running = true;
  chrome.storage.local.set({ running: true });
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: "start-camera" }).catch(() => {});
}

async function stop() {
  running = false;
  chrome.storage.local.set({ running: false });
  chrome.runtime.sendMessage({ type: "stop-camera" }).catch(() => {});
  // Small delay before closing offscreen so the stop message is delivered
  setTimeout(() => closeOffscreen(), 500);
}

// ---- Scroll the active tab ----

async function scrollActiveTab(direction) {
  const now = Date.now();
  if (now - lastScrollTime < scrollCooldown) return;
  lastScrollTime = now;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, {
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
      scrollActiveTab("up");
    } else if (msg.gesture === "scroll_down") {
      scrollActiveTab("down");
    }
  }
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
