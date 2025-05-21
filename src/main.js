/*****************************************************************
 *  Application entry-point  +  main loop
 *****************************************************************/

/* ────────────────────────────────────────────────────────────
   0)  GLOBAL TOGGLE – detailed head-pose logging
   ──────────────────────────────────────────────────────────── */
const DEEP_DEBUG = true;   // ⬅️ flip to false to silence dyaw/dpitch spam

/*****************************************************************
 *  1)  CAMERA
 *****************************************************************/
import { initCamera } from './modules/camera.js';

/*****************************************************************
 *  2)  FACE
 *****************************************************************/
import {
    loadDetector as loadFaceDetector,
    detectFaces,
} from './modules/multiFaceDetector.js';
import { createClassifierMap } from './modules/gestureClassifier.js';

/*****************************************************************
 *  3)  HAND
 *****************************************************************/
import {
    loadHandDetector,
    detectHands,
} from './modules/handDetector.js';
import { createHandGestureClassifier } from './modules/handGestureClassifier.js';

/*****************************************************************
 *  4)  UI  &  APP STATE
 *****************************************************************/
import { drawOverlays } from './modules/overlayRenderer.js';
import { set, get } from './store.js';
import {
    startVoteMeter,
    resetVoteMeter,
} from './modules/voteTally.js';
import { startQuestionCycle } from './modules/questionRotator.js';
import { initChat, sendVote } from './modules/chatClient.js';
import { initAttractor } from './modules/attractor.js';
import './modules/healthMonitor.js'; // side-effects only

/* ────────────────────────────────────────────────────────────
   Runtime references
   ──────────────────────────────────────────────────────────── */
let video, canvas;
let faceDetector, faceClassifier;
let handDetector, handClassifier;
let lastFrameTime = performance.now();

/* ────────────────────────────────────────────────────────────
   Quick on-screen YES / NO flash (debug only)
   ──────────────────────────────────────────────────────────── */
function showGesture(g) {
    const el = document.getElementById('gestureIndicator');
    el.textContent = g.toUpperCase();
    el.style.backgroundColor = g === 'yes' ? 'limegreen' : 'tomato';
    el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 800);
}

/* ────────────────────────────────────────────────────────────
   SET-UP
   ──────────────────────────────────────────────────────────── */
async function setup() {
    /* 1. camera stream + overlay canvas */
    ({ video, canvas } = await initCamera());

    /* 2. detectors & classifiers */
    faceDetector = await loadFaceDetector();
    faceClassifier = createClassifierMap({ deepDebug: DEEP_DEBUG });  // 👈 new param

    handDetector = await loadHandDetector();
    handClassifier = createHandGestureClassifier();

    /* 3. ancillary UI */
    startQuestionCycle();
    initChat();
    initAttractor();
    startVoteMeter();

    /* 4. reset button */
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        faceClassifier.reset();
        handClassifier?.reset?.();
        resetVoteMeter();
        set({ votes: {}, mode: 'idle' });
    });

    /* 5. enter main loop */
    requestAnimationFrame(tick);
}

/* ────────────────────────────────────────────────────────────
   MAIN LOOP
   ──────────────────────────────────────────────────────────── */
function tick() {
    /* 1) run detectors */
    const faces = detectFaces(faceDetector, video);
    const hands = detectHands(handDetector, video);

    /* 2) wake UI if somebody walks in */
    if (faces.length && get().mode === 'idle') set({ mode: 'active' });

    /* 3) head gestures → yes / no */
    faceClassifier.update(faces).forEach(({ id, gesture }) => {
        flashBox(id, gesture);
        sendVote(gesture);
        showGesture(gesture);
    });

    /* 4) hand gestures → yes / no */
    handClassifier.update(hands).forEach(({ gesture }) => {
        if (gesture === 'thumbs_up' || gesture === 'thumbs_down') {
            const mapped = gesture === 'thumbs_up' ? 'yes' : 'no';
            sendVote(mapped);
            showGesture(mapped);
        }
    });

    /* 5) overlay rendering */
    drawOverlays(faces, hands, canvas);

    /* 6) FPS counter (debug sidebar) */
    set({ fps: Math.round(1000 / (performance.now() - lastFrameTime)) });
    lastFrameTime = performance.now();

    requestAnimationFrame(tick);
}

/* helper used by overlayRenderer to briefly highlight a face box */
const lastFlash = {};
function flashBox(faceId, gesture) {
    lastFlash[faceId] = { gesture, time: performance.now() };
}

/* ────────────────────────────────────────────────────────────
   Boot-strap
   ──────────────────────────────────────────────────────────── */
setup().catch(err => console.error('Setup error:', err));
