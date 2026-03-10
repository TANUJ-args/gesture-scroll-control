"""
Gesture Control: Scroll Up / Scroll Down using hand signs.
- Scroll Up:  "7" sign — thumb up + index pointing out, middle/ring/pinky closed
- Scroll Down: Open palm — all five fingers extended
"""

import cv2
import numpy as np
import time
from pathlib import Path
import urllib.request
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import RunningMode
import pyautogui

# Model download
HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_DIR = Path(__file__).parent / "models"
HAND_MODEL_PATH = MODEL_DIR / "hand_landmarker.task"

# Camera
CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# Drawing
HAND_COLOR = (0, 200, 0)
TEXT_COLOR = (0, 255, 0)
HAND_LINE_THICKNESS = 2

# Scroll tuning
SCROLL_AMOUNT = 40         # lines per frame while gesture is held
SCROLL_COOLDOWN = 0.05     # min seconds between scroll actions

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12),
    (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20),
    (5, 9), (9, 13), (13, 17),
]


def download_model(url: str, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    print(f"Downloading model to {path} ...")
    urllib.request.urlretrieve(url, path)
    print("Model downloaded")


def create_hand_task():
    download_model(HAND_MODEL_URL, HAND_MODEL_PATH)
    options = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(HAND_MODEL_PATH)),
        running_mode=RunningMode.VIDEO,
        num_hands=1,
    )
    return vision.HandLandmarker.create_from_options(options)


def draw_hand_landmarks(frame, hand_landmarks):
    if not hand_landmarks:
        return
    h, w = frame.shape[:2]
    for hand in hand_landmarks:
        pts = []
        for p in hand:
            x, y = int(p.x * w), int(p.y * h)
            pts.append((x, y))
            cv2.circle(frame, (x, y), 3, HAND_COLOR, -1)
        for a, b in HAND_CONNECTIONS:
            if a < len(pts) and b < len(pts):
                cv2.line(frame, pts[a], pts[b], HAND_COLOR, HAND_LINE_THICKNESS)


def is_finger_extended(lm, tip_idx, pip_idx, mcp_idx):
    """Check if a non-thumb finger is extended (tip above PIP in y)."""
    return lm[tip_idx].y < lm[pip_idx].y


def is_thumb_extended(lm, handedness):
    """Check if the thumb is extended (tip further out than IP joint).
    After mirror-flip the camera image is already mirrored, so we check
    based on MediaPipe's reported handedness label."""
    thumb_tip = lm[4]
    thumb_ip = lm[3]
    if handedness == "Left":
        return thumb_tip.x < thumb_ip.x   # extends to the left of frame
    else:
        return thumb_tip.x > thumb_ip.x   # extends to the right of frame


def detect_gesture(hand_landmarks, handedness_list):
    """Return 'scroll_up', 'scroll_down', or None."""
    if not hand_landmarks or not handedness_list:
        return None
    lm = hand_landmarks[0]
    if len(lm) < 21:
        return None

    handedness = handedness_list[0][0].category_name  # "Left" or "Right"

    thumb = is_thumb_extended(lm, handedness)
    index = is_finger_extended(lm, 8, 6, 5)
    middle = is_finger_extended(lm, 12, 10, 9)
    ring = is_finger_extended(lm, 16, 14, 13)
    pinky = is_finger_extended(lm, 20, 18, 17)

    # Scroll Up: "7" — thumb + index extended, rest closed
    if thumb and index and not middle and not ring and not pinky:
        return "scroll_up"

    # Scroll Down: open palm — all five extended
    if thumb and index and middle and ring and pinky:
        return "scroll_down"

    return None


def put_status_text(frame, lines):
    x, y = 10, 30
    for line in lines:
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, TEXT_COLOR, 2)
        y += 28


def main():
    pyautogui.FAILSAFE = False
    hand_task = create_hand_task()

    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    if not cap.isOpened():
        print("Cannot open camera")
        return

    print("Gesture Scroll Control running. Press 'q' to quit.")

    last_scroll_time = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts_ms = int(time.time() * 1000)

            hand_result = hand_task.detect_for_video(mp_image, ts_ms)
            draw_hand_landmarks(frame, hand_result.hand_landmarks if hand_result else None)

            gesture = detect_gesture(
                hand_result.hand_landmarks if hand_result else None,
                hand_result.handedness if hand_result else None,
            )

            now = time.time()
            gesture_label = "No gesture"
            if gesture == "scroll_up" and (now - last_scroll_time) >= SCROLL_COOLDOWN:
                pyautogui.scroll(SCROLL_AMOUNT)
                last_scroll_time = now
                gesture_label = "SCROLL UP  [7 sign]"
            elif gesture == "scroll_down" and (now - last_scroll_time) >= SCROLL_COOLDOWN:
                pyautogui.scroll(-SCROLL_AMOUNT)
                last_scroll_time = now
                gesture_label = "SCROLL DOWN [open palm]"

            # Color the gesture label
            if "UP" in gesture_label:
                label_color = (0, 255, 0)
            elif "DOWN" in gesture_label:
                label_color = (0, 0, 255)
            else:
                label_color = TEXT_COLOR

            lines = [
                "Gesture Scroll Control",
                f"Gesture: {gesture_label}",
                "7 sign = Scroll Up | Open palm = Scroll Down",
                "Press 'q' to quit",
            ]
            put_status_text(frame, lines)

            # Large centered gesture indicator
            h, w = frame.shape[:2]
            if gesture:
                cv2.putText(
                    frame, gesture_label, (w // 2 - 180, h - 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, label_color, 3,
                )

            cv2.imshow("Gesture Scroll Control", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Shutdown complete")


if __name__ == "__main__":
    main()
