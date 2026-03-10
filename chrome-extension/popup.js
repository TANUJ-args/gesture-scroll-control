// popup.js — Settings UI logic for Gesture Scroll Control

const toggleBtn = document.getElementById('toggleBtn');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const cooldownSlider = document.getElementById('cooldownSlider');
const cooldownValue = document.getElementById('cooldownValue');
const pdfAutoToggle = document.getElementById('pdfAutoToggle');
const gestureDisplay = document.getElementById('gestureDisplay');

// Load saved settings
chrome.storage.local.get(
  { scrollSpeed: 40, scrollCooldown: 50, pdfAuto: true, running: false },
  (data) => {
    speedSlider.value = data.scrollSpeed;
    speedValue.textContent = data.scrollSpeed;
    cooldownSlider.value = data.scrollCooldown;
    cooldownValue.textContent = data.scrollCooldown;
    pdfAutoToggle.checked = data.pdfAuto;
    updateStatusUI(data.running);
  }
);

// Speed slider
speedSlider.addEventListener('input', () => {
  const val = parseInt(speedSlider.value, 10);
  speedValue.textContent = val;
  chrome.storage.local.set({ scrollSpeed: val });
  chrome.runtime.sendMessage({ type: 'settings', scrollSpeed: val });
});

// Cooldown slider
cooldownSlider.addEventListener('input', () => {
  const val = parseInt(cooldownSlider.value, 10);
  cooldownValue.textContent = val;
  chrome.storage.local.set({ scrollCooldown: val });
  chrome.runtime.sendMessage({ type: 'settings', scrollCooldown: val });
});

// PDF auto toggle
pdfAutoToggle.addEventListener('change', () => {
  chrome.storage.local.set({ pdfAuto: pdfAutoToggle.checked });
  chrome.runtime.sendMessage({ type: 'settings', pdfAuto: pdfAutoToggle.checked });
});

// Start / Stop
toggleBtn.addEventListener('click', () => {
  chrome.storage.local.get({ running: false }, (data) => {
    const next = !data.running;
    chrome.storage.local.set({ running: next });
    chrome.runtime.sendMessage({ type: next ? 'start' : 'stop' });
    updateStatusUI(next);
  });
});

function updateStatusUI(running) {
  if (running) {
    statusDot.classList.add('active');
    statusLabel.textContent = 'Running';
    toggleBtn.textContent = 'Stop';
    toggleBtn.classList.add('stop');
  } else {
    statusDot.classList.remove('active');
    statusLabel.textContent = 'Stopped';
    toggleBtn.textContent = 'Start';
    toggleBtn.classList.remove('stop');
  }
}

// Listen for gesture updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'gesture') {
    if (msg.gesture === 'scroll_up') {
      gestureDisplay.textContent = '⬆️ SCROLL UP [7 sign]';
      gestureDisplay.className = 'detected';
    } else if (msg.gesture === 'scroll_down') {
      gestureDisplay.textContent = '⬇️ SCROLL DOWN [open palm]';
      gestureDisplay.className = 'detected';
    } else {
      gestureDisplay.textContent = '—';
      gestureDisplay.className = '';
    }
  }
  if (msg.type === 'stopped') {
    updateStatusUI(false);
  }
});
