// camera.js — Runs in the camera window, handles webcam + MediaPipe detection

import {
  HandLandmarker,
  FilesetResolver,
} from "./vision_bundle.mjs";

let handLandmarker = null;
let animFrameId = null;
let stream = null;

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");

// ---- Gesture detection ----

function isFingerExtended(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y < lm[pipIdx].y;
}

function isThumbExtended(lm, handedness) {
  const tip = lm[4];
  const ip = lm[3];
  if (handedness === "Left") return tip.x < ip.x;
  return tip.x > ip.x;
}

function detectGesture(landmarks, handedness) {
  if (!landmarks || landmarks.length === 0) return null;
  const lm = landmarks[0];
  if (lm.length < 21) return null;

  const hand = handedness[0][0].categoryName;

  const thumb = isThumbExtended(lm, hand);
  const index = isFingerExtended(lm, 8, 6);
  const middle = isFingerExtended(lm, 12, 10);
  const ring = isFingerExtended(lm, 16, 14);
  const pinky = isFingerExtended(lm, 20, 18);

  if (thumb && index && !middle && !ring && !pinky) return "scroll_up";
  if (thumb && index && middle && ring && pinky) return "scroll_down";

  return null;
}

// ---- Init & Run ----

async function init() {
  try {
    statusEl.textContent = "Loading hand model...";
    statusEl.className = "none";

    const vision = await FilesetResolver.forVisionTasks(
      chrome.runtime.getURL("wasm")
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    });
  } catch (e) {
    console.warn("GPU delegate failed, falling back to CPU:", e.message);
    const vision = await FilesetResolver.forVisionTasks(
      chrome.runtime.getURL("wasm")
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }

  try {
    statusEl.textContent = "Requesting camera...";
    const video = document.getElementById("webcam");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    video.srcObject = stream;
    await video.play();

    statusEl.textContent = "Detecting gestures...";
    statusEl.className = "none";

    // Tell background we're ready
    chrome.runtime.sendMessage({ type: "camera-ready" });

    let lastTime = -1;
    function processFrame() {
      if (!handLandmarker || video.readyState < 2) {
        animFrameId = requestAnimationFrame(processFrame);
        return;
      }

      const now = performance.now();
      if (now === lastTime) {
        animFrameId = requestAnimationFrame(processFrame);
        return;
      }
      lastTime = now;

      const result = handLandmarker.detectForVideo(video, now);
      const gesture = detectGesture(result.landmarks, result.handednesses);

      // Update local status display
      if (gesture === "scroll_up") {
        statusEl.textContent = "⬆️ SCROLL UP [7 sign]";
        statusEl.className = "up";
      } else if (gesture === "scroll_down") {
        statusEl.textContent = "⬇️ SCROLL DOWN [open palm]";
        statusEl.className = "down";
      } else {
        statusEl.textContent = "No gesture — show your hand";
        statusEl.className = "none";
      }

      // Send to background
      chrome.runtime.sendMessage({ type: "gesture", gesture });

      animFrameId = requestAnimationFrame(processFrame);
    }

    animFrameId = requestAnimationFrame(processFrame);
  } catch (err) {
    statusEl.textContent = "Camera error";
    statusEl.className = "none";
    errorEl.style.display = "block";
    errorEl.textContent = err.message;
    chrome.runtime.sendMessage({ type: "camera-error", error: err.message });
  }
}

// Cleanup when window closes
window.addEventListener("beforeunload", () => {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  chrome.runtime.sendMessage({ type: "camera-closed" });
});

init();
