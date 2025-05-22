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
import { createCalibrator } from './modules/calibrator.js';
import { initCalibratorUI } from './modules/calibratorUI.js';

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


/* ────────────────────────────────────────────────────────────
   Runtime references
   ──────────────────────────────────────────────────────────── */
let video, canvas;
let faceDetector, faceClassifier;
let handDetector, handClassifier;
const calibrators = new Map();
let calibUI;
let pendingCalib = false;
let fps = 30,
    lastTs = performance.now();
const lastVoteTime = { yes: 0, no: 0 };
const COOLDOWN = 500; // minimum time between votes per gesture



function getYawPitch(lm) {
    return {
        yaw: lm[234].x - lm[454].x,
        pitch: lm[10].y - lm[152].y,
    };
}

let firstSeen = 0;
let lostSince = 0;


function updateFps(now) {
    const dt = now - lastTs;
    lastTs = now;
    fps = fps * 0.9 + (1000 / dt) * 0.1;
    set({ fps: Math.round(fps) });
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
    if (now - lastVoteTime[gesture] > COOLDOWN) {
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
        ...mbp2020Defaults,
        pitchThresh: 0.1,
        swingMinMs: 200,
        oppSwingRatio: 0.4,
    });

    handDetector = await loadHandDetector();
    handClassifier = createHandGestureClassifier();

    /* 3. ancillary UI */
    await startQuestionCycle();
    initChat();
    initAttractor();
    startVoteMeter();
    calibUI = initCalibratorUI();
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
    if (calibrateBtn) calibrateBtn.onclick = () => { pendingCalib = true; };

    document.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            registerVote('yes');
        } else if (e.code === 'Backspace') {
            registerVote('no');
        }
    });

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


    faces.forEach((lm, id) => {
        if (!lm[234] || !lm[454] || !lm[10] || !lm[152]) return;
        const { yaw, pitch } = getYawPitch(lm);

        let cal = calibrators.get(id);
        if (!cal) {
            cal = createCalibrator();
            calibrators.set(id, cal);
        }

        if (pendingCalib || (cal.state !== 'READY' && !cal.active)) {
            cal.start(yaw, pitch);
            if (pendingCalib) calibUI?.showToast('Hold still…');
        }

        const res = cal.update(yaw, pitch);

        if (res.baseline) {
            faceClassifier.calibrate(id, res.baseline);
            calibUI?.showToast('Calibration complete');
            calibUI?.beep();
        }

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

    /* 2) wake UI if somebody walks in */
    if (faces.length && get().mode === 'idle') set({ mode: 'active' });

    /* 3) head gestures → yes / no */
    faceClassifier.update(faces).forEach(({ id, gesture }) => {
        if (calibrators.get(id)?.state !== 'READY') return;
        appendLog(`FSM-state=${faceClassifier.state}  gesture=${gesture}`);
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
