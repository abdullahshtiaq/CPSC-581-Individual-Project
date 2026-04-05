"""
Fish Tank CV Backend
--------------------
Captures from webcam, detects faces using MediaPipe FaceMesh, estimates:
  - distance  : face bounding box width in pixels
  - yaw       : head pose yaw angle in degrees (+ = right, - = left)
  - identity  : name of enrolled person, or None

Streams JSON over WebSocket on ws://localhost:8765
The browser frontend connects here and drives the UI interactions.

Install dependencies:
    pip install mediapipe face_recognition websockets opencv-python-headless numpy

Enroll faces first:
    python enroll.py owner /path/to/photo.jpg
"""

import asyncio
import json
import os

import cv2
import face_recognition
import mediapipe as mp
import numpy as np
import websockets

# ---------------------------------------------------------------------------
# Load enrolled faces from enrolled/*.npy
# ---------------------------------------------------------------------------

ENROLLED_DIR = os.path.join(os.path.dirname(__file__), "enrolled")
ENROLLED_FACES: dict[str, np.ndarray] = {}

def load_enrolled_faces():
    if not os.path.isdir(ENROLLED_DIR):
        print("[enroll] No enrolled/ directory found — identity detection disabled.")
        return
    for fname in os.listdir(ENROLLED_DIR):
        if fname.endswith(".npy"):
            name = fname[:-4]
            ENROLLED_FACES[name] = np.load(os.path.join(ENROLLED_DIR, fname))
            print(f"[enroll] Loaded face for: {name}")

# ---------------------------------------------------------------------------
# Head pose — solvePnP using 6 stable MediaPipe landmark indices
# Returns yaw in degrees; positive = turned right, negative = turned left.
# ---------------------------------------------------------------------------

# 3D face model reference points (generic)
_MODEL_POINTS = np.array([
    [0.0,    0.0,    0.0   ],   # nose tip      (landmark 1)
    [0.0,  -330.0,  -65.0  ],   # chin          (landmark 152)
    [-225.0, 170.0, -135.0 ],   # left eye      (landmark 263)
    [225.0,  170.0, -135.0 ],   # right eye     (landmark 33)
    [-150.0,-150.0, -125.0 ],   # left mouth    (landmark 287)
    [150.0, -150.0, -125.0 ],   # right mouth   (landmark 57)
], dtype="double")

_LM_IDX = [1, 152, 263, 33, 287, 57]


def compute_yaw(landmarks, w: int, h: int) -> float:
    image_points = np.array([
        [landmarks.landmark[i].x * w, landmarks.landmark[i].y * h]
        for i in _LM_IDX
    ], dtype="double")

    focal = w
    cam_matrix = np.array([
        [focal, 0,     w / 2],
        [0,     focal, h / 2],
        [0,     0,     1    ],
    ], dtype="double")
    dist_coeffs = np.zeros((4, 1))

    success, rvec, _ = cv2.solvePnP(
        _MODEL_POINTS, image_points, cam_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not success:
        return 0.0

    rmat, _ = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    return float(angles[1])   # yaw


# ---------------------------------------------------------------------------
# Face recognition — runs every N frames to keep CPU load low
# ---------------------------------------------------------------------------

RECOGNITION_INTERVAL = 10  # frames between recognition attempts
RECOGNITION_THRESHOLD = 0.55


def recognize_face(frame: np.ndarray) -> str | None:
    if not ENROLLED_FACES:
        return None
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb)
    if not encodings:
        return None
    for name, enrolled_enc in ENROLLED_FACES.items():
        dist = face_recognition.face_distance([enrolled_enc], encodings[0])[0]
        if dist < RECOGNITION_THRESHOLD:
            return name
    return None


# ---------------------------------------------------------------------------
# Main WebSocket handler
# ---------------------------------------------------------------------------

async def handler(websocket):
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    mp_face_mesh = mp.solutions.face_mesh
    frame_count = 0
    last_identity: str | None = None

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.05)
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)
            frame_count += 1

            if not results.multi_face_landmarks:
                last_identity = None
                payload = {"detected": False}
            else:
                lm = results.multi_face_landmarks[0]
                h, w = frame.shape[:2]

                # Distance: face bounding box width in pixels
                xs = [p.x * w for p in lm.landmark]
                ys = [p.y * h for p in lm.landmark]
                face_width_px = max(xs) - min(xs)

                # Head pose yaw
                yaw = compute_yaw(lm, w, h)

                # Identity — expensive, run every N frames only
                if frame_count % RECOGNITION_INTERVAL == 0:
                    last_identity = recognize_face(frame)

                payload = {
                    "detected": True,
                    "face_width_px": face_width_px,
                    "yaw": yaw,
                    "identity": last_identity,
                }

            try:
                await websocket.send(json.dumps(payload))
            except websockets.exceptions.ConnectionClosed:
                break

            await asyncio.sleep(0.05)   # ~20 fps cap

    cap.release()


async def main():
    print("[backend] Starting WebSocket server on ws://localhost:8765")
    load_enrolled_faces()
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()   # run forever


if __name__ == "__main__":
    asyncio.run(main())
