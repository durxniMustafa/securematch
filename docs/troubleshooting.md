# Gesture Troubleshooting Guide

This guide explains why common gesture-recognition issues occur and how to resolve them when using `gestureClassifier.js`.

| Symptom | Why it happens | What to try |
|---------|----------------|-------------|
| **No gesture fires**<br>`deepDebug` shows `dy`/`dp` always under ±0.08 | The default `yawThresh`/`pitchThresh` (0.10) are higher than your measured deltas. This happens when faces are small in the frame or on wide‑angle cameras. | Lower the thresholds to around **0.04** or enlarge the face area. Example: `createClassifierMap({ yawThresh: 0.05, pitchThresh: 0.05 })` |
| **Values cross the threshold but nothing emits** | Stage 2 requires the swing to last **≥ `swingMinMs` (180 ms)** and pass through the baseline in the opposite direction. Low‑FPS video (≤ 15 FPS) can miss that window. | Reduce `swingMinMs` (e.g. 100 ms) **or** add a `swingMinFrames` check and allow either condition to trigger the gesture. |
| **First nod after load is ignored** | The baseline uses the pose on the very first frame, so any initial tilt reduces the apparent movement of the first gesture. | Hold still for a moment – the kiosk now auto‑calibrates after one second of steadiness – or click `Calibrate` manually. |
| **A few nods work, then nothing** | The adaptive baseline treats slow motion as "still" and gradually drifts toward the new pose. Future gestures then fall below the thresholds. | Increase `baselineTol` (e.g. 0.025) to ignore casual motion or shorten `baselineWindowMs` so baseline drift only occurs when truly still. |
| **Shakes recognised but nods aren't (or vice versa)** | The **axis veto** (`axisVetoFactor = 0.8`) rejects nods if lateral motion is 80 % of its threshold. Camera tilt mixes yaw into pitch, causing the veto. | Lower `axisVetoFactor` (e.g. 0.4) or level the camera. Using actual yaw/pitch angles instead of pixel deltas avoids this coupling. |

| **Landmark deltas read as zero** | Landmarks 234/454/10/152 have `visibility < minVis` (0.5) or sometimes return `undefined`. | Lower `minVis` to 0.3 and guard against `undefined`: `if (!lm[234] || !lm[454]) return;` |

