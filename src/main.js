/*****************************************************************
 *  Application entry-point  +  main loop
 *****************************************************************/

/* ────────────────────────────────────────────────────────────
   0)  GLOBAL TOGGLE – detailed head-pose logging
   ──────────────────────────────────────────────────────────── */
const DEEP_DEBUG = false;   // set true for verbose dyaw/dpitch logging

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
import { createClassifierMap, DEFAULT_THRESH_MBPRO } from './modules/gestureClassifier.js';

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
const lastVoteTime = { yes: 0, no: 0 };

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

function registerVote(gesture) {
    const now = performance.now();
    if (now - lastVoteTime[gesture] > 800) {
        lastVoteTime[gesture] = now;
        sendVote(gesture);
        showGesture(gesture);
    }
}

/* ────────────────────────────────────────────────────────────
   SET-UP
   ──────────────────────────────────────────────────────────── */
async function setup() {
    /* 1. camera stream + overlay canvas */
    ({ video, canvas } = await initCamera());

    /* 2. detectors & classifiers */
    faceDetector = await loadFaceDetector();
    faceClassifier = createClassifierMap({
        deepDebug: DEEP_DEBUG,
        yawThresh: DEFAULT_THRESH_MBPRO,
        pitchThresh: DEFAULT_THRESH_MBPRO
    });

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
        for (const k in lastFlash) delete lastFlash[k];
    });

    /* 5. enter main loop */
    scheduleTick();
}

/* ────────────────────────────────────────────────────────────
   MAIN LOOP
   ──────────────────────────────────────────────────────────── */
function tick() {
    /* 1) run detectors */
    const faces = detectFaces(faceDetector, video);
    const hands = faces.length ? detectHands(handDetector, video) : [];

    /* 2) wake UI if somebody walks in */
    if (faces.length && get().mode === 'idle') set({ mode: 'active' });

    /* 3) head gestures → yes / no */
    faceClassifier.update(faces).forEach(({ id, gesture }) => {
        flashBox(id, gesture);
        registerVote(gesture);
    });

    /* 4) hand gestures → yes / no */
    handClassifier.update(hands).forEach(({ gesture }) => {
        if (gesture === 'thumbs_up' || gesture === 'thumbs_down') {
            const mapped = gesture === 'thumbs_up' ? 'yes' : 'no';
            registerVote(mapped);
        }
    });

    /* 5) overlay rendering */
    if (get().mode !== 'idle') {
        drawOverlays(faces, hands, canvas, lastFlash);
    }
    pruneFlashes();

    /* 6) FPS counter (debug sidebar) */
    set({ fps: Math.round(1000 / (performance.now() - lastFrameTime)) });
    lastFrameTime = performance.now();

    scheduleTick();
}

/* helper used by overlayRenderer to briefly highlight a face box */
const lastFlash = {};
function flashBox(faceId, gesture) {
    lastFlash[faceId] = { gesture, time: performance.now() };
}

function pruneFlashes() {
    const now = performance.now();
    for (const id in lastFlash) {
        if (now - lastFlash[id].time > 500) {
            delete lastFlash[id];
        }
    }
}

function scheduleTick() {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback(() => tick());
    } else {
        requestAnimationFrame(tick);
        setTimeout(tick, 33); // keep running when RAF pauses
    }
}

/* ────────────────────────────────────────────────────────────
   Boot-strap
   ──────────────────────────────────────────────────────────── */
setup().catch(err => console.error('Setup error:', err));
