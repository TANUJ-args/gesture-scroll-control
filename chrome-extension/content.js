// content.js — Injected into every page to perform scrolling

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "scroll") return;

  const amount = msg.amount || 40;
  const pixels = amount * 3; // convert "lines" to approximate pixels

  if (msg.direction === "up") {
    window.scrollBy({ top: -pixels, behavior: "auto" });
  } else if (msg.direction === "down") {
    window.scrollBy({ top: pixels, behavior: "auto" });
  }
});
