/*****************************************************************
 *  Application entry-point + main loop
 *****************************************************************/

// 0) GLOBAL TOGGLE – detailed head-pose logging
const DEEP_DEBUG = true;   // or set via URL param

/*****************************************************************
 *  1) CAMERA
 *****************************************************************/
import { initCamera } from './modules/camera.js';

/*****************************************************************
 *  2) FACE
 *****************************************************************/
import {
    loadDetector as loadFaceDetector,
    detectFaces
} from './modules/multiFaceDetector.js';

import { createGestureDetector } from './modules/gestureDetector.js';
import { matrixToEuler } from './modules/poseUtils.js';
import { GESTURE } from './modules/gestureConfig.js';
import { createCalibrator } from './modules/calibrator.js';
import { initCalibratorUI } from './modules/calibratorUI.js';

/*****************************************************************
 *  3) HAND
 *****************************************************************/
import {
    loadHandDetector,
    detectHands
} from './modules/handDetector.js';
import { createHandGestureClassifier } from './modules/handGestureClassifier.js';

/*****************************************************************
 *  4) UI & APP STATE
 *****************************************************************/
import { drawOverlays } from './modules/overlayRenderer.js';
import { set, get, subscribe, appendLog } from './store.js';
import {
    startVoteMeter,
    resetVoteMeter
} from './modules/voteTally.js';
import { startQuestionCycle } from './modules/questionRotator.js';
import { initChat, sendVote } from './modules/chatClient.js';
import { initAttractor } from './modules/attractor.js';
import './modules/healthMonitor.js'; // side-effects only
import { initLogger } from './modules/logger.js';

/* ────────────────────────────────────────────────────────────
   Runtime references
   ──────────────────────────────────────────────────────────── */
let video, canvas;
let faceDetector, faceClassifier;
let handDetector, handClassifier;
const calibrators = new Map();
let calibUI;

let pendingCalib = false;
let fps = 30;
let lastTs = performance.now();

const lastVoteTime = { yes: 0, no: 0 };
const COOLDOWN = 500; // min time between votes per gesture

function getYawPitch(matrix) {
    const { yaw, pitch } = matrixToEuler(matrix);
    if (DEEP_DEBUG) {
        console.log('yawDeg=', yaw.toFixed(2), 'pitchDeg=', pitch.toFixed(2));
    }
    return { yaw, pitch };
}

let firstSeen = 0;
let lostSince = 0;

function updateFps(now) {
    const dt = now - lastTs;
    lastTs = now;
    if (dt > 0) {
        fps = 0.9 * fps + 0.1 * (1000 / dt);
        set({ fps: Math.round(fps) });
    }
}

/**
 * Show a quick on-screen yes/no flash for debug
 */
function showGesture(g) {
    const el = document.getElementById('gestureIndicator');
    el.textContent = g.toUpperCase();
    el.style.backgroundColor = (g === 'yes') ? 'limegreen' : 'tomato';
    el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 800);
}

/**
 * Register & log a yes/no vote
 */
function registerVote(gesture) {
    const now = performance.now();
    if (now - lastVoteTime[gesture] > COOLDOWN) {
        lastVoteTime[gesture] = now;
        sendVote(gesture);
        showGesture(gesture);
        appendLog(`Gesture accepted: ${gesture}`);
    } else {
        appendLog(`Gesture ignored (cooldown): ${gesture}`);
    }
}

/* ────────────────────────────────────────────────────────────
   SET-UP
   ──────────────────────────────────────────────────────────── */
async function setup() {
    // 1) camera
    ({ video, canvas } = await initCamera());

    // 2) face + classifier
    faceDetector = await loadFaceDetector();

    faceClassifier = createGestureDetector({
        ...GESTURE
    });

    // 3) hand
    handDetector = await loadHandDetector();
    handClassifier = createHandGestureClassifier();

    // 4) ancillary UI
    await startQuestionCycle();
    initChat();
    initAttractor();
    startVoteMeter();
    calibUI = initCalibratorUI();
    initLogger(subscribe);
    appendLog('App initialised');

    // 5) controls
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            faceClassifier.reset();
            handClassifier?.reset?.();
            resetVoteMeter();
            set({ votes: {}, mode: 'idle' });
        });
    }

    const calibrateBtn = document.getElementById('calibrateBtn');
    if (calibrateBtn) {
        calibrateBtn.onclick = () => { pendingCalib = true; };
    }

    document.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            registerVote('yes');
        } else if (e.code === 'Backspace') {
            registerVote('no');
        }
    });

    // 6) go
    scheduleTick();
}

/**
 * The main loop for each video frame
 */
function tick(now) {
    updateFps(now);

    // 1) run face + hand detection
    const faceRes = detectFaces(faceDetector, video);
    const faces = faceRes.faceLandmarks;
    const matrices = faceRes.facialTransformationMatrixes;
    const hands = faces.length ? detectHands(handDetector, video) : [];

    // Attempt calibration or update calibrators
    faces.forEach((lm, id) => {
        const mat = matrices[id];
        if (!mat) return;

        const { yaw, pitch } = getYawPitch(mat);

        let cal = calibrators.get(id);
        if (!cal) {
            cal = createCalibrator();
            calibrators.set(id, cal);
        }

        // if user clicked calibrate or hasn't calibrated yet
        if ((pendingCalib && cal.state !== 'READY') || (cal.state === 'WAIT_STABLE' && !cal.active)) {
            cal.start(yaw, pitch);
            if (pendingCalib) calibUI?.showToast('Hold still…');
        }

        const res = cal.update(yaw, pitch);
        if (res.baseline) {
            faceClassifier.calibrate(id, res.baseline);
            calibUI?.showToast('Calibration complete');
            calibUI?.beep();
        }

        // update calibrator UI for the main face (id=0)
        if (id === 0) {
            calibUI?.update(res.progress || 0, res.still);
            if (DEEP_DEBUG) {
                const dy = yaw - cal.baseline.yaw;
                const dp = pitch - cal.baseline.pitch;
                calibUI?.updateInfo(`dy=${dy.toFixed(3)} dp=${dp.toFixed(3)}`);
            }
        }
    });
    pendingCalib = false;

    // face-lost state
    if (faces.length) {
        if (!firstSeen) firstSeen = performance.now();
        lostSince = 0;
    } else {
        firstSeen = 0;
        if (!lostSince) lostSince = performance.now();
        if (performance.now() - lostSince > 1000) {
            calibUI?.showToast('Face lost — look at camera to resume.');
            lostSince = performance.now();
        }
    }

    // 2) wake UI if a face appears
    if (faces.length && get().mode === 'idle') set({ mode: 'active' });

    // 3) classify head gestures → yes/no
    faceClassifier.update(faceRes).forEach(({ id, gesture }) => {
        if (calibrators.get(id)?.state !== 'READY') return; // skip uncalibrated
        registerVote(gesture);
    });

    // 4) classify hand gestures
    handClassifier.update(hands).forEach(({ gesture }) => {
        if (gesture === 'thumbs_up' || gesture === 'thumbs_down') {
            const mapped = (gesture === 'thumbs_up') ? 'yes' : 'no';
            registerVote(mapped);
        }
    });

    // 5) overlay rendering
    if (get().mode !== 'idle') {
        drawOverlays(faces, hands, canvas, lastFlash);
    }
    pruneFlashes();

    const meter = document.getElementById('gestureMeter');
    if (meter) meter.value = faceClassifier.getMeterValue();

    scheduleTick();
}

/* helper for overlayRenderer to highlight a face box briefly */
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

/**
 * The core scheduling
 */
function scheduleTick() {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback((nowTS) => tick(nowTS));
    } else {
        requestAnimationFrame((rafNow) => tick(rafNow));
        setTimeout(tick, 33); // fallback
    }
}

/* ────────────────────────────────────────────────────────────
   Boot-strap
   ──────────────────────────────────────────────────────────── */
setup().catch(err => console.error('Setup error:', err));
