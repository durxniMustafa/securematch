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

import { set, get, subscribe, appendLog } from './store.js';

import {
    startVoteMeter,
    resetVoteMeter,
} from './modules/voteTally.js';
import { startQuestionCycle } from './modules/questionRotator.js';
import { initChat, sendVote } from './modules/chatClient.js';
import { initAttractor } from './modules/attractor.js';
import './modules/healthMonitor.js'; // side-effects only

import { initLogger } from './modules/logger.js';

import './modules/logger.js'; // side-effects only


/* ────────────────────────────────────────────────────────────
   Runtime references
   ──────────────────────────────────────────────────────────── */
let video, canvas;
let faceDetector, faceClassifier;
let handDetector, handClassifier;
let fps = 30,
    lastTs = performance.now();
const lastVoteTime = { yes: 0, no: 0 };

let lastYaw = 0,
    lastPitch = 0;

let firstSeen = 0,
    autoCalibrated = false;


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
    if (now - lastVoteTime[gesture] > 800) {
        lastVoteTime[gesture] = now;
        sendVote(gesture);
        showGesture(gesture);

        appendLog(`Vote sent: ${gesture}`);

        appendLog(`Gesture detected: ${gesture}`);

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
        pitchThresh: DEFAULT_THRESH_MBPRO,
        ...mbp2020Defaults,
        deepDebug: DEEP_DEBUG,
    });

    handDetector = await loadHandDetector();
    handClassifier = createHandGestureClassifier();

    /* 3. ancillary UI */
    await startQuestionCycle();
    initChat();
    initAttractor();
    startVoteMeter();
    initLogger(subscribe);
    appendLog('App initialised');

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
    scheduleTick();
}

/* ────────────────────────────────────────────────────────────
   MAIN LOOP
   ──────────────────────────────────────────────────────────── */
function tick(now) {
    updateFps(now);
    /* 1) run detectors */
    const faces = detectFaces(faceDetector, video);
    const hands = faces.length ? detectHands(handDetector, video) : [];


    if (faces[0] && faces[0][234] && faces[0][454] && faces[0][10] && faces[0][152]) {
        const yaw = faces[0][234].x - faces[0][454].x;
        const pitch = faces[0][10].y - faces[0][152].y;
        if (Math.abs(yaw - lastYaw) > 0.02 || Math.abs(pitch - lastPitch) > 0.02) {
            lastYaw = yaw;
            lastPitch = pitch;
            appendLog(`yaw=${yaw.toFixed(3)} pitch=${pitch.toFixed(3)}`);
        }
    }

    if (faces.length) {
        if (!firstSeen) firstSeen = performance.now();
        if (!autoCalibrated && performance.now() - firstSeen > 1000) {
            faceClassifier.calibrate();
            appendLog('Auto calibrated');
            autoCalibrated = true;
        }
    } else {
        firstSeen = 0;
        autoCalibrated = false;
    }

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

    const meter = document.getElementById('gestureMeter');
    if (meter) meter.value = faceClassifier.getMeterValue();

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
