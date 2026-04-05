"""
Face Enrollment Script
-----------------------
Computes a 128-D face descriptor from a photo and saves it to enrolled/<name>.npy
The backend loads these descriptors at startup for identity recognition.

Usage:
    python enroll.py <name> <photo_path>

Example:
    python enroll.py owner ~/Desktop/me.jpg
"""

import sys
import os
import face_recognition
import numpy as np


def enroll(name: str, photo_path: str):
    if not os.path.isfile(photo_path):
        print(f"Error: file not found: {photo_path}")
        sys.exit(1)

    print(f"Loading image: {photo_path}")
    image = face_recognition.load_image_file(photo_path)
    encodings = face_recognition.face_encodings(image)

    if not encodings:
        print("Error: no face detected in the image. Use a clear, front-facing photo.")
        sys.exit(1)

    if len(encodings) > 1:
        print(f"Warning: {len(encodings)} faces found — using the first one.")

    os.makedirs("enrolled", exist_ok=True)
    out_path = os.path.join("enrolled", f"{name}.npy")
    np.save(out_path, encodings[0])
    print(f"Enrolled '{name}' successfully → {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python enroll.py <name> <photo_path>")
        sys.exit(1)
    enroll(sys.argv[1], sys.argv[2])
