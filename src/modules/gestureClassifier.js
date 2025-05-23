// src/modules/gestureClassifier.js
// Head gesture classifier (nod="yes", shake="no") with a velocity-based FSM
// for subtle 0–1 scale face landmarks. Baseline is frozen after calibration.

import { gestureConfig } from './gestureConfig.js';
import { createOneEuroFilter } from './oneEuro.js';

export const DEFAULT_THRESH_MBPRO = 0.06;

/**
 * Creates a new classifier instance.
 * Call .update(faces) each frame;
 * it returns an array of {id, gesture, confidence} events.
 *
 * Usage note:
 *  - Call .calibrate(id) once the user is in neutral pose to freeze the baseline.
 *  - For debugging, set deepDebug: true and watch the console logs.
 */
export function createClassifierMap(options = {}) {
    const cfg = Object.assign({}, gestureConfig, options, {
        /** final override: ensure logs appear */
        deepDebug: true

    });

    const state = new Map();  // ID -> per-face state
    let meterValue = 0;
    let publicState = '';
    let debugVals = { yawDot: 0, pitchDot: 0 };

    function prune(now) {
        // remove stale face states after lostTimeoutMs
        for (const [id, s] of state) {
            if (!s._seen && (now - s.lastSeen > cfg.lostTimeoutMs)) {
                state.delete(id);
            }
        }
    }

    /** Basic vector helpers for 3-D pose */
    function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }; }
    function cross(a, b) { return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x }; }
    function normalize(v) {
        const len = Math.hypot(v.x, v.y, v.z || 0) || 1;
        return { x: v.x/len, y: v.y/len, z: (v.z||0)/len };
    }

    /**
     * Solve a crude 3-D head pose from a handful of rigid landmarks.
     * Returns yaw, pitch and roll in radians.
     */
    function computePose(lm, prev) {
        const left = lm[234], right = lm[454];
        const top = lm[10], bottom = lm[152];
        if (!left || !right || !top || !bottom) return prev;

        let xAxis = normalize(vsub(right, left));
        let yAxis = normalize(vsub(top, bottom));
        let zAxis = normalize(cross(xAxis, yAxis));
        yAxis = normalize(cross(zAxis, xAxis));

        const R = [
            [xAxis.x, yAxis.x, zAxis.x],
            [xAxis.y, yAxis.y, zAxis.y],
            [xAxis.z, yAxis.z, zAxis.z]
        ];
        const yaw = Math.atan2(R[0][2], R[2][2]);
        const pitch = Math.asin(-R[1][2]);
        const roll = Math.atan2(R[1][0], R[1][1]);
        return { yaw, pitch, roll };
    }

    /**
     * Slowly adapt the baseline when no gesture is in progress
     * to compensate for posture drift.
     */
    function adaptBaseline(s, dt) {
        const k = cfg.baselineBlendK;
        s.baseline.yaw += (s.smoothYaw - s.baseline.yaw) * k * dt;
        s.baseline.pitch += (s.smoothPitch - s.baseline.pitch) * k * dt;
    }

    /**
     * Main update function: call each frame with an array of face landmarks.
     * Returns: array of { id, gesture, confidence }
     */
    function update(faces) {
        const now = performance.now();
        const gestures = [];

        // Mark all old faces as unseen
        state.forEach(s => (s._seen = false));
        meterValue = 0;
        publicState = '';

        faces.forEach((lm, id) => {
            let s = state.get(id);
            if (!s) {
                // first time for face id => init
                const yaw = lm[234].x - lm[454].x;
                const pitch = lm[10].y - lm[152].y;
                s = {
                    baseline: { yaw, pitch }, // freeze after calibrate
                    lastYaw: yaw,
                    lastPitch: pitch,
                    smoothYaw: yaw,
                    smoothPitch: pitch,
                    yawFilter: createOneEuroFilter({ minCutoff: 1.0, beta: 0.005 }),
                    pitchFilter: createOneEuroFilter({ minCutoff: 1.0, beta: 0.005 }),

                    // velocity-FSM
                    nodState: 'idle',
                    nodT0: 0,
                    nodDir: 0,
                    nodConsecutiveFrames: 0, // For debounce

                    shakeSwinging: false,
                    shakeDir: 0,
                    shakeT0: 0,

                    yawBuf: [],
                    pitchBuf: [],

                    // store angles used for raw velocity
                    prevYawFiltered: yaw,
                    prevPitchFiltered: pitch,

                    lastFrameTs: now,
                    lastEmit: 0,
                    velHold: 0,
                    lastSeen: now,
                };
                state.set(id, s);
            }

            s._seen = true;
            s.lastSeen = now;

            // 1) compute full head pose (yaw, pitch, roll)
            const nowMs = performance.now();
            const pose = computePose(lm, { yaw: s.lastYaw, pitch: s.lastPitch, roll: s.lastRoll || 0 });
            const yaw = pose.yaw;
            const pitch = pose.pitch;
            s.lastYaw = yaw;
            s.lastPitch = pitch;
            s.lastRoll = pose.roll;

            // 2) one-euro filtering for stability
            const fYaw = s.yawFilter.update(yaw, nowMs);
            const fPitch = s.pitchFilter.update(pitch, nowMs);
            s.smoothYaw = fYaw;
            s.smoothPitch = fPitch;

            // 3) compute relative to baseline for amplitude
            const dyaw = fYaw - s.baseline.yaw;
            const dpitch = fPitch - s.baseline.pitch;

            // 4) velocity from filtered angles
            const dt = (nowMs - s.lastFrameTs) / 1000 || 0.033;
            s.lastFrameTs = nowMs;

            let yawDot = (fYaw - s.prevYawFiltered) / dt;
            let pitchDot = (fPitch - s.prevPitchFiltered) / dt;
            s.prevYawFiltered = fYaw;
            s.prevPitchFiltered = fPitch;

            // Cap velocity (Fix 3)
            yawDot = Math.min(cfg.MAX_VEL, Math.max(-cfg.MAX_VEL, yawDot));
            pitchDot = Math.min(cfg.MAX_VEL, Math.max(-cfg.MAX_VEL, pitchDot));

            if (s.velHold > 0) {
                s.velHold--;
                yawDot = 0;
                pitchDot = 0;
            }

            // 5) deep debug logs for face 0
            if (cfg.deepDebug && id === 0) {
                console.log(
                    `[${nowMs.toFixed(0)}ms]`,
                    'yaw=', s.smoothYaw.toFixed(3),
                    'pitch=', s.smoothPitch.toFixed(3),
                    'dyaw=', dyaw.toFixed(3),
                    'dpitch=', dpitch.toFixed(3),
                    'yawDot=', yawDot.toFixed(3),
                    'pitchDot=', pitchDot.toFixed(3)
                );
                debugVals.yawDot = yawDot;
                debugVals.pitchDot = pitchDot;
            }

            // 6) rolling average for guard veto
            s.yawBuf.push(Math.abs(dyaw));
            s.pitchBuf.push(Math.abs(dpitch));
            if (s.yawBuf.length > 10) s.yawBuf.shift();
            if (s.pitchBuf.length > 10) s.pitchBuf.shift();
            const avgAbsYaw = s.yawBuf.reduce((a, b) => a + b, 0) / s.yawBuf.length;
            const avgAbsPitch = s.pitchBuf.reduce((a, b) => a + b, 0) / s.pitchBuf.length;

            // For debug meter
            if (id === 0) meterValue = Math.abs(yawDot) / cfg.yVel;

            /* ---------------------------------------------------------------
               YES (nod) FSM
               ---------------------------------------------------------------*/
            switch (s.nodState) {
                case 'idle':
                    // Require both velocity and amplitude gate
                    if (Math.abs(pitchDot) > cfg.pVel && Math.abs(dpitch) > cfg.pitchAmp) {
                        s.nodState = 'nod_started';
                        s.nodDir = Math.sign(pitchDot);
                        s.nodT0 = nowMs;
                    }
                    break;

                case 'nod_started': {
                    const crossed = Math.abs(dpitch) > cfg.pitchAmp;
                    const enoughTime = (nowMs - s.nodT0 < cfg.nodWindowMs);
                    const reversedVel =
                        (s.nodDir < 0 && pitchDot > cfg.pVel) ||
                        (s.nodDir > 0 && pitchDot < -cfg.pVel);

                    if (reversedVel && crossed && enoughTime) {
                        s.nodConsecutiveFrames++; // Increment debounce counter
                        if (
                            s.nodConsecutiveFrames >= 3 && // Check debounce (Fix 1)
                            avgAbsYaw < cfg.guardYaw &&
                            (nowMs - s.lastEmit > cfg.refractoryMs)
                        ) {
                            // final nod
                            const conf = Math.min(1, Math.abs(pitchDot) / cfg.pVel);
                            gestures.push({ id, gesture: 'yes', confidence: conf });
                            s.lastEmit = nowMs;
                            s.velHold = cfg.velHoldFrames;
                            s.nodState = 'idle'; // Reset after gesture
                            s.nodConsecutiveFrames = 0; // Reset debounce counter
                        }
                        // If not enough consecutive frames, but conditions met, stay in nod_started
                        // (unless it's a timeout, handled below)
                    } else if (!enoughTime) {
                        s.nodState = 'idle'; // timeout
                        s.nodConsecutiveFrames = 0; // Reset debounce on timeout
                    } else {
                        // Conditions for reversal/amplitude not met, reset debounce counter
                        s.nodConsecutiveFrames = 0;
                        // Potentially reset nodState to 'idle' if velocity is no longer significant
                        // or if direction changed without crossing amplitude.
                        // For now, let's keep it simple and only reset on timeout or successful gesture.
                        // If we want to be stricter, we could reset to idle here too.
                    }
                    break;
                }
            }

            /* ---------------------------------------------------------------
               NO (shake) FSM
               ---------------------------------------------------------------*/
            if (!s.shakeSwinging && Math.abs(yawDot) > cfg.yVel && Math.abs(dyaw) > cfg.yawAmp) {
                s.shakeSwinging = true;
                s.shakeDir = Math.sign(yawDot);
                s.shakeT0 = nowMs;
            }
            if (s.shakeSwinging) {
                const crossed = Math.abs(dyaw) > cfg.yawAmp;
                // need velocity in opposite direction
                if (
                    Math.sign(yawDot) === -s.shakeDir &&
                    Math.abs(yawDot) > cfg.yVel &&
                    crossed
                ) {
                    if (
                        (nowMs - s.shakeT0 < cfg.shakeWindowMs) &&
                        (avgAbsPitch < cfg.guardPitch) &&
                        (nowMs - s.lastEmit > cfg.refractoryMs)
                    ) {
                        const conf = Math.min(1, Math.abs(yawDot) / cfg.yVel);
                        gestures.push({ id, gesture: 'no', confidence: conf });
                        s.lastEmit = nowMs;
                        s.velHold = cfg.velHoldFrames;
                    }
                    s.shakeSwinging = false;
                }
                if (nowMs - s.shakeT0 > cfg.shakeWindowMs) {
                    s.shakeSwinging = false; // timed out
                }
            }

            // adapt baseline slowly when idle
            if (s.nodState === 'idle' && !s.shakeSwinging &&
                Math.abs(yawDot) < cfg.yVel * 0.1 &&
                Math.abs(pitchDot) < cfg.pVel * 0.1) {
                adaptBaseline(s, dt);
            }

            // For debugging display
            if (id === 0) {
                publicState = s.nodState + (s.shakeSwinging ? 'S' : '');
            }
        });

        // remove stale
        prune(now);
        return gestures;
    }

    /**
     * Freeze baseline for a face (or all).
     * Typically called once user is in neutral pose.
     */
    function calibrate(faceId = null, baseline = null) {
        if (faceId !== null) {
            const s = state.get(faceId);
            if (s) {
                s.baseline = baseline
                    ? { yaw: baseline.yaw, pitch: baseline.pitch }
                    : { yaw: s.smoothYaw, pitch: s.smoothPitch };
            }
        } else {
            state.forEach(s => {
                s.baseline = baseline
                    ? { yaw: baseline.yaw, pitch: baseline.pitch }
                    : { yaw: s.smoothYaw, pitch: s.smoothPitch };
            });
        }
    }

    /**
     * Clear face states (for a reset).
     */
    function reset() {
        state.clear();
        publicState = '';
    }

    return {
        update,
        reset,
        calibrate,
        config: cfg,

        /* For a small UI meter (range [0..1]) if velocity ~ yVel => 1.0 */
        getMeterValue: () => meterValue,

        /* Debug info: e.g. "nod_startedS" => nod FSM=nod_started, shakeFSM=swinging */
        get state() { return publicState; },
        get debug() { return debugVals; },
    };
}
