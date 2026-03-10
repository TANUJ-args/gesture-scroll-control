// offscreen.js — Webcam + MediaPipe hand gesture detection (runs in offscreen document)

import {
  HandLandmarker,
  FilesetResolver,
} from "./vision_bundle.mjs";

let handLandmarker = null;
let animFrameId = null;
let stream = null;

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ---- Gesture detection (same logic as the Python version) ----

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

  const hand = handedness[0][0].categoryName; // "Left" or "Right"

  const thumb = isThumbExtended(lm, hand);
  const index = isFingerExtended(lm, 8, 6);
  const middle = isFingerExtended(lm, 12, 10);
  const ring = isFingerExtended(lm, 16, 14);
  const pinky = isFingerExtended(lm, 20, 18);

  // Scroll Up: "7" sign — thumb + index, rest closed
  if (thumb && index && !middle && !ring && !pinky) return "scroll_up";

  // Scroll Down: open palm — all five extended
  if (thumb && index && middle && ring && pinky) return "scroll_down";

  return null;
}

// ---- Initialise MediaPipe ----

async function initHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    chrome.runtime.getURL("wasm")
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

// ---- Webcam loop ----

async function startCamera() {
  const video = document.getElementById("webcam");
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();

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

    // Send gesture to background service worker
    chrome.runtime.sendMessage({ type: "gesture", gesture });

    animFrameId = requestAnimationFrame(processFrame);
  }

  animFrameId = requestAnimationFrame(processFrame);
}

function stopCamera() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

// ---- Message handling from background ----

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-camera") {
    initHandLandmarker().then(() => startCamera());
  }
  if (msg.type === "stop-camera") {
    stopCamera();
  }
});
