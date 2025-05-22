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
import { createClassifierMap } from './modules/gestureClassifier.js';
import { mbp2020Defaults } from './modules/mbp2020Defaults.js';

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
let fps = 30,
    lastTs = performance.now();
const lastVoteTime = { yes: 0, no: 0 };

function updateFps(now) {
    const dt = now - lastTs;
    lastTs = now;
    fps = fps * 0.9 + (1000 / dt) * 0.1;
    set({ fps: Math.round(fps) });
    if (faceClassifier) {
        faceClassifier.config.swingMinMs = Math.max(120, 1.5 * 1000 / fps);
    }
}

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
    if (now - lastVoteTime[gesture] > 1000) {
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
        ...mbp2020Defaults,
        deepDebug: DEEP_DEBUG
    });

    handDetector = await loadHandDetector();
    handClassifier = createHandGestureClassifier();

    /* 3. ancillary UI */
    startQuestionCycle();
    initChat();
    initAttractor();
    startVoteMeter();

    /* 4. controls */
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        faceClassifier.reset();
        handClassifier?.reset?.();
        resetVoteMeter();
        set({ votes: {}, mode: 'idle' });
        for (const k in lastFlash) delete lastFlash[k];
    });

    const calibrateBtn = document.getElementById('calibrateBtn');
    if (calibrateBtn) calibrateBtn.onclick = () => faceClassifier.calibrate();

    /* 5. enter main loop */
    requestAnimationFrame(tick);
}

/* ────────────────────────────────────────────────────────────
   MAIN LOOP
   ──────────────────────────────────────────────────────────── */
function tick(now) {
    updateFps(now);
    /* 1) run detectors */
    const faces = detectFaces(faceDetector, video);
    const hands = detectHands(handDetector, video);

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
    drawOverlays(faces, hands, canvas, lastFlash);
    pruneFlashes();

    const meter = document.getElementById('gestureMeter');
    if (meter) meter.value = faceClassifier.getMeterValue();

    requestAnimationFrame(tick);
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

/* ────────────────────────────────────────────────────────────
   Boot-strap
   ──────────────────────────────────────────────────────────── */
setup().catch(err => console.error('Setup error:', err));
