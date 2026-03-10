# ✋ Gesture Scroll Control

Control page scrolling with hand gestures using your webcam. Works as a **Chrome extension** and as a standalone **Python app**.

![Demo](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Gestures

| Gesture | Hand Sign | Action |
|---------|-----------|--------|
| **7 sign** | 👆 Thumb up + index finger pointing out, middle/ring/pinky closed | **Scroll Up** |
| **Open palm** | 🖐️ All five fingers extended | **Scroll Down** |

---

## Chrome Extension (Recommended)

### Install

1. Download or clone this repo
2. Open Chrome → go to `chrome://extensions`
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `chrome-extension` folder
5. Pin the extension to your toolbar

### Use

1. Click the extension icon in your toolbar
2. Press **Start** — allow camera access when prompted
3. Show your hand to the webcam:
   - **7 sign** (thumb + index up, rest closed) → page scrolls **up**
   - **Open palm** (all 5 fingers out) → page scrolls **down**
4. Adjust settings in the popup:
   - **Scroll Speed** slider (1–100) — how far each scroll moves
   - **Scroll Cooldown** slider (20–500ms) — how fast scrolling repeats
   - **Auto-activate on PDF** toggle — auto-starts gesture detection when you open a PDF

### Tips

- Good lighting helps gesture accuracy
- Hold your hand ~1–2 feet from the webcam
- Keep your hand steady for consistent detection
- Works on any webpage, Google Docs, PDFs, etc.

---

## Python Standalone App

If you prefer a desktop app without Chrome:

### Requirements

- Python 3.9+
- Webcam

### Setup

```bash
git clone https://github.com/TANUJ-args/gesture-scroll-control.git
cd gesture-scroll-control
pip install -r requirements.txt
python main.py
```

### Dependencies

```
opencv-python>=4.8.0
mediapipe>=0.10.0
numpy>=1.24.0
pyautogui>=0.9.54
```

The Python version opens a webcam window, detects the same two gestures, and uses `pyautogui` to scroll whatever window is in focus.

---

## Project Structure

```
gesture-scroll-control/
├── main.py                  # Python standalone app
├── requirements.txt         # Python dependencies
├── models/                  # MediaPipe model files (auto-downloaded)
│   └── hand_landmarker.task
├── chrome-extension/        # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js        # Service worker
│   ├── offscreen.html/js    # Webcam + MediaPipe hand detection
│   ├── popup.html/js        # Settings UI
│   ├── content.js           # Scrolls the active page
│   ├── vision_bundle.mjs    # MediaPipe JS (bundled)
│   ├── wasm/                # MediaPipe WASM binaries
│   └── icons/               # Extension icons
└── README.md
```

## How It Works

1. **Webcam feed** is processed frame-by-frame using [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
2. **21 hand landmarks** are detected per frame
3. Each finger is checked for **extended vs. closed** by comparing landmark Y-positions
4. Thumb extension accounts for hand orientation (left/right)
5. The combination maps to a gesture → triggers scroll up or down

## Tech Stack

- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) — hand landmark detection
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) — extension platform
- Offscreen API — webcam access from service worker context
- OpenCV + PyAutoGUI — Python standalone version

## License

MIT — use it however you like.
