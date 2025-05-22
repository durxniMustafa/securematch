# Architecture Overview

This document outlines how video data flows through the kiosk and how messages are exchanged with the WebSocket server. It also explains where to tweak common settings.

## High-Level Flow

1. **Video capture** – `camera.js` obtains a stream from the user's webcam.
2. **Detection** – frames are processed by `multiFaceDetector.js` and `handDetector.js` to find faces and hands.
3. **Gesture classification** – detections are fed into `gestureClassifier.js` (head nods/shakes) and `handGestureClassifier.js` (thumb gestures).
4. **Vote dispatch** – classified gestures trigger `chatClient.js` to send `vote` messages over WebSocket to `server/wsServer.js`.
5. **Tally display** – the server broadcasts updates that `voteTally.js` renders in real time.

## WebSocket Message Formats

All messages are JSON objects with a `type` field.

### `vote`
Sent by clients when a gesture is recognised.
```json
{ "type": "vote", "gesture": "yes" | "no" }
```
The server increments the tally and broadcasts:
```json
{ "type": "vote", "delta": { "yes": 1 } }
```
(or `"no"` accordingly)

### `chat`
Arbitrary chat messages can be sent using:
```json
{ "type": "chat", "msg": "Hello" }
```
The server appends the text to its history and echoes the same object to all clients.

### `snapshot`
When a client connects it receives the current state:
```json
{ "type": "snapshot", "tally": { "yes": 0, "no": 0 }, "chatHistory": [] }
```

## Customisation

### Editing the Question List
Questions are defined near the top of [`src/modules/questionRotator.js`](../src/modules/questionRotator.js):
```javascript
const questions = [
    "Is cybersecurity everyone's responsibility?",
    "Do you lock your laptop whenever you walk away?",
    "Would you nod to indicate 'yes' right now?",
];
```
Modify this array to change what appears in the kiosk.

### Adjusting Gesture Thresholds
The gesture classifier accepts threshold options. [`src/modules/mbp2020Defaults.js`](../src/modules/mbp2020Defaults.js) provides a preset used in [`src/main.js`](../src/main.js):
```javascript
faceClassifier = createClassifierMap({
    yawThresh: DEFAULT_THRESH_MBPRO,
    pitchThresh: DEFAULT_THRESH_MBPRO,
    ...mbp2020Defaults,
});
```
Tweaking values in `mbp2020Defaults.js`—such as `yawThresh` or `pitchThresh`—alters how sensitive nod and shake detection is.

