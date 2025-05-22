// src/modules/gestureClassifier.js
// Head gesture classifier (nod="yes", shake="no") with a velocity-based FSM
// for subtle 0–1 scale face landmarks. Baseline is frozen after calibration.

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
    const cfg = Object.assign({
        // Basic configuration
        bufferMs: 700,
        lostTimeoutMs: 1000,
        smoothFactor: 0.3,   // we lowered from 0.4 for less smoothing
        minVis: 0.25,        // only used if you do check .visibility

        /**
         * Less sensitive thresholds to avoid
         * detecting small bobs or micro-shakes:
         */
        pVel: 0.30,     // was 0.25; now needs ~10–12 deg/s in 0–1 coords
        yVel: 0.25,     // was 0.25
        pitchAmp: 0.07, // was 0.06
        yawAmp: 0.06,  // was 0.06

        nodWindowMs: 600,  // time from down→up
        shakeWindowMs: 700, // time for 2 swings

        guardYaw: 0.30,     // was 0.25; veto nod if yaw is large
        guardPitch: 0.30,   // was 0.30; veto shake if pitch is large
        refractoryMs: 1000,  // was 800; lock-out after detection

    }, options, {
        /** final override: ensure logs appear */
        deepDebug: true
    });

    const state = new Map();  // ID -> per-face state
    let meterValue = 0;
    let publicState = '';

    function prune(now) {
        // remove stale face states after lostTimeoutMs
        for (const [id, s] of state) {
            if (!s._seen && (now - s.lastSeen > cfg.lostTimeoutMs)) {
                state.delete(id);
            }
        }
    }

    /**
     * Unconditional yaw/pitch; if a landmark is missing,
     * fallback to prev.
     */
    function getYawPitch(lm, prevYaw, prevPitch) {
        const yaw =
            (lm[234] && lm[454]) ? (lm[234].x - lm[454].x) : prevYaw;
        const pitch =
            (lm[10] && lm[152]) ? (lm[10].y - lm[152].y) : prevPitch;
        return { yaw, pitch };
    }

    /** We do not adapt the baseline; calibrate() is explicit. */
    function adaptBaseline() { /* no-op */ }

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

                    // velocity-FSM
                    nodState: 'idle',
                    nodT0: 0,
                    nodDir: 0,

                    shakeSwinging: false,
                    shakeDir: 0,
                    shakeT0: 0,

                    yawBuf: [],
                    pitchBuf: [],

                    // store angles used for raw velocity
                    prevYawRaw: yaw,
                    prevPitchRaw: pitch,

                    lastFrameTs: now,
                    lastEmit: 0,
                    lastSeen: now,
                };
                state.set(id, s);
            }

            s._seen = true;
            s.lastSeen = now;

            // 1) get raw yaw/pitch
            const { yaw, pitch } = getYawPitch(lm, s.lastYaw, s.lastPitch);
            s.lastYaw = yaw;
            s.lastPitch = pitch;

            // 2) smoothing for amplitude checks
            s.smoothYaw += (yaw - s.smoothYaw) * cfg.smoothFactor;
            s.smoothPitch += (pitch - s.smoothPitch) * cfg.smoothFactor;

            // 3) compute relative to baseline for amplitude
            const dyaw = s.smoothYaw - s.baseline.yaw;
            const dpitch = s.smoothPitch - s.baseline.pitch;

            // 4) raw velocity
            const nowMs = performance.now();
            const dt = (nowMs - s.lastFrameTs) / 1000 || 0.033;
            s.lastFrameTs = nowMs;

            const yawDot = (yaw - s.prevYawRaw) / dt;
            const pitchDot = (pitch - s.prevPitchRaw) / dt;
            s.prevYawRaw = yaw;
            s.prevPitchRaw = pitch;

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
                    // Wait for pitch velocity big enough
                    if (Math.abs(pitchDot) > cfg.pVel) {
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
                        if (
                            avgAbsYaw < cfg.guardYaw &&
                            (nowMs - s.lastEmit > cfg.refractoryMs)
                        ) {
                            // final nod
                            const conf = Math.min(1, Math.abs(pitchDot) / cfg.pVel);
                            gestures.push({ id, gesture: 'yes', confidence: conf });
                            s.lastEmit = nowMs;
                        }
                        s.nodState = 'idle';
                    } else if (!enoughTime) {
                        s.nodState = 'idle'; // timeout
                    }
                    break;
                }
            }

            /* ---------------------------------------------------------------
               NO (shake) FSM
               ---------------------------------------------------------------*/
            if (!s.shakeSwinging && Math.abs(yawDot) > cfg.yVel) {
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
                    }
                    s.shakeSwinging = false;
                }
                if (nowMs - s.shakeT0 > cfg.shakeWindowMs) {
                    s.shakeSwinging = false; // timed out
                }
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
    };
}
