import { initCamera } from './modules/camera.js';
import { loadDetector, detectFaces } from './modules/multiFaceDetector.js';
import { createClassifierMap } from './modules/gestureClassifier.js';
import { drawOverlays } from './modules/overlayRenderer.js';
import { subscribe, set, get } from './store.js';
import { startVoteMeter, stopVoteMeter } from './modules/voteTally.js';
import { startQuestionCycle } from './modules/questionRotator.js';
import { hideQR, showQR } from './modules/qrGenerator.js';
import { initChat } from './modules/chatClient.js';
import { initAttractor } from './modules/attractor.js';
import { startConfetti, stopConfetti } from './modules/confettiRenderer.js';
import './modules/healthMonitor.js'; // auto-runs some checks

let video, canvas;
let detector;
let classifier;

// 1. Setup camera, face detector, gesture classifier
async function setup() {
    // Start camera
    ({ video, canvas } = await initCamera());

    // Load face detector
    detector = await loadDetector();

    // Create gesture classifier buffer
    classifier = createClassifierMap();

    // Start question cycle
    startQuestionCycle();

    // Start websockets chat
    initChat();

    // Start attractor logic
    initAttractor();

    // Start tally meter (Chart.js)
    startVoteMeter();

    // Start the main loop
    requestAnimationFrame(tick);
}

// 2. Main loop: detect faces → classify gestures → draw overlays
function tick() {
    const faces = detectFaces(detector, video);
    // store the number of faces we see
    const numFaces = faces.length;

    // If at least 1 face is visible, we set mode 'active' if currently 'idle'
    if (numFaces > 0 && get().mode === 'idle') {
        set({ mode: 'active' });
    }

    // 2a. gesture classification
    const results = classifier.update(faces);
    // results can be something like [{id:0, gesture:'yes'}, ...]
    results.forEach(r => {
        // flash overlay color + send to server
        flashBox(r.id, r.gesture);
        sendVote(r.gesture);
    });

    // 2b. draw overlays (based on first face’s gesture if multiple)
    let highlight = null;
    if (results.length) {
        highlight = { focusId: results[0].id, gesture: results[0].gesture };
    }
    drawOverlays(faces, canvas, highlight?.focusId, highlight?.gesture);

    // update FPS (optional)
    set({ fps: Math.round(1000 / (performance.now() - lastFrameTime)) });
    lastFrameTime = performance.now();

    requestAnimationFrame(tick);
}

let lastFlash = {};
function flashBox(faceId, gesture) {
    // Just store a timestamp or do something more advanced
    lastFlash[faceId] = { gesture, time: performance.now() };
}

function sendVote(gesture) {
    // WebSocket logic in chatClient module handles it. We'll just call a function there:
    import('./modules/chatClient.js').then(({ sendVote }) => {
        sendVote(gesture);
    });
}

// Start everything on page load
let lastFrameTime = performance.now();
setup().catch(err => console.error(err));
