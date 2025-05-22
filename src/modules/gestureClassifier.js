// src/modules/gestureClassifier.js
// Head gesture classifier (nod = "yes", shake = "no") with adaptive baseline
// and runtime-configurable thresholds.

export const DEFAULT_THRESH_MBPRO = 0.06;

export function createClassifierMap(options = {}) {
    const cfg = Object.assign({
        yawThresh: 0.1,
        pitchThresh: 0.1,
        bufferMs: 600,
        lostTimeoutMs: 1000,
        swingMinMs: 180,
        baselineTol: 0.015,
        axisVetoFactor: 0.8,
        baselineWindowMs: 1000,
        baselineSmoothing: 0.05,
        debounceMs: 250,
        smoothFactor: 0.4,
        deepDebug: false,
        minVis: 0.5,
        // linear scaling factor for confidence computation
        confidenceLinear: 1.5,
    }, options);

    const state = new Map();
    let meterValue = 0;
    let publicState = '';

    function prune(now) {
        for (const [id, s] of state) {
            if (!s._seen && now - s.lastSeen > cfg.lostTimeoutMs) {
                state.delete(id);
            }
        }
    }

    function getYawPitch(lm, prevYaw, prevPitch) {
        let yaw = prevYaw, pitch = prevPitch;
        if (lm[234]?.visibility >= cfg.minVis && lm[454]?.visibility >= cfg.minVis) {
            yaw = lm[234].x - lm[454].x;
        }
        if (lm[10]?.visibility >= cfg.minVis && lm[152]?.visibility >= cfg.minVis) {
            pitch = lm[10].y - lm[152].y;
        }
        return { yaw, pitch };
    }

    function adaptBaseline(s, yaw, pitch, now) {
        const dy = yaw - s.baseline.yaw;
        const dp = pitch - s.baseline.pitch;
        const still = Math.abs(dy) < cfg.baselineTol && Math.abs(dp) < cfg.baselineTol;
        if (still && s.stageYaw === 0 && s.stagePitch === 0) {
            if (!s.steadySince) s.steadySince = now;
            if (now - s.steadySince >= cfg.baselineWindowMs) {
                s.baseline.yaw += (yaw - s.baseline.yaw) * cfg.baselineSmoothing;
                s.baseline.pitch += (pitch - s.baseline.pitch) * cfg.baselineSmoothing;
                const MAX_SHIFT = 0.04;
                s.baseline.yaw = Math.max(s.smoothYaw - MAX_SHIFT, Math.min(s.smoothYaw + MAX_SHIFT, s.baseline.yaw));
                s.baseline.pitch = Math.max(s.smoothPitch - MAX_SHIFT, Math.min(s.smoothPitch + MAX_SHIFT, s.baseline.pitch));
            }
        } else {
            s.steadySince = 0;
        }
    }

    function update(faces) {
        const now = performance.now();
        const gestures = [];
        state.forEach(s => { s._seen = false; });

        meterValue = 0;
        publicState = '';
        faces.forEach((lm, id) => {
            let s = state.get(id);
            if (!s) {
                const yaw = lm[234].x - lm[454].x;
                const pitch = lm[10].y - lm[152].y;
                s = {
                    baseline: { yaw, pitch },
                    lastYaw: yaw,
                    lastPitch: pitch,
                    smoothYaw: yaw,
                    smoothPitch: pitch,
                    buf: [],
                    stageYaw: 0, tYaw1: 0, maxYaw: 0, yawDir: 0,
                    stagePitch: 0, tPitch1: 0, maxPitch: 0, pitchDir: 0,
                    lastEmit: 0,
                    lastSeen: now,
                    steadySince: 0,
                };
                state.set(id, s);
            }

            s._seen = true;
            s.lastSeen = now;

            const { yaw, pitch } = getYawPitch(lm, s.lastYaw, s.lastPitch);
            s.lastYaw = yaw;
            s.lastPitch = pitch;

            s.smoothYaw += (yaw - s.smoothYaw) * cfg.smoothFactor;
            s.smoothPitch += (pitch - s.smoothPitch) * cfg.smoothFactor;

            const dyaw = s.smoothYaw - s.baseline.yaw;
            const dpitch = s.smoothPitch - s.baseline.pitch;
            if (id === 0) meterValue = Math.abs(dyaw) / cfg.yawThresh;
            if (s.stageYaw > 0) s.maxYaw = Math.max(s.maxYaw, Math.abs(dyaw));
            if (s.stagePitch > 0) s.maxPitch = Math.max(s.maxPitch, Math.abs(dpitch));
            s.buf.push({ dyaw, dpitch, t: now });
            while (s.buf[0] && now - s.buf[0].t > cfg.bufferMs) s.buf.shift();

            adaptBaseline(s, s.smoothYaw, s.smoothPitch, now);

            if (cfg.deepDebug) {
                console.debug(`face ${id} dy=${dyaw.toFixed(3)} dp=${dpitch.toFixed(3)}`);
            }

            if (s.stageYaw === 0 && Math.abs(dyaw) > cfg.yawThresh) {
                s.stageYaw = 1;
                s.yawDir = Math.sign(dyaw);
                s.tYaw1 = now;
                s.maxYaw = Math.abs(dyaw);
            }
            if (s.stageYaw === 1 && Math.sign(dyaw) === -s.yawDir && Math.abs(dyaw) > cfg.yawThresh && now - s.tYaw1 >= cfg.swingMinMs) {
                s.stageYaw = 2;
                s.maxYaw = Math.max(s.maxYaw, Math.abs(dyaw));
            }
            if (s.stageYaw === 2 && Math.abs(dyaw) < cfg.baselineTol) { s.stageYaw = 3; }

            if (s.stagePitch === 0 && Math.abs(dpitch) > cfg.pitchThresh) {
                s.stagePitch = 1;
                s.pitchDir = Math.sign(dpitch);
                s.tPitch1 = now;
                s.maxPitch = Math.abs(dpitch);
            }
            if (s.stagePitch === 1 && Math.sign(dpitch) === -s.pitchDir && Math.abs(dpitch) > cfg.pitchThresh && now - s.tPitch1 >= cfg.swingMinMs) {
                s.stagePitch = 2;
                s.maxPitch = Math.max(s.maxPitch, Math.abs(dpitch));
            }
            if (s.stagePitch === 2 && Math.abs(dpitch) < cfg.baselineTol) { s.stagePitch = 3; }

            if (s.stageYaw === 3) {
                const maxPitch = Math.max(...s.buf.map(o => Math.abs(o.dpitch)));
                if (maxPitch < cfg.pitchThresh * cfg.axisVetoFactor && now - s.lastEmit > cfg.debounceMs) {
                    const conf = Math.min(1, s.maxYaw / (cfg.yawThresh * cfg.confidenceLinear));
                    gestures.push({ id, gesture: 'no', confidence: conf });
                    s.lastEmit = now;
                }
                s.stageYaw = 0;
                s.yawDir = 0;
                s.maxYaw = 0;
            }

            if (s.stagePitch === 3) {
                const maxYaw = Math.max(...s.buf.map(o => Math.abs(o.dyaw)));
                if (maxYaw < cfg.yawThresh * cfg.axisVetoFactor && now - s.lastEmit > cfg.debounceMs) {
                    const conf = Math.min(1, s.maxPitch / (cfg.pitchThresh * cfg.confidenceLinear));
                    gestures.push({ id, gesture: 'yes', confidence: conf });
                    s.lastEmit = now;
                }
                s.stagePitch = 0;
                s.pitchDir = 0;
                s.maxPitch = 0;
            }

            if (id === 0) {
                publicState = `Y${s.stageYaw}P${s.stagePitch}`;
            }
        });

        prune(now);
        return gestures;
    }

    function calibrate(faceId = null) {
        if (faceId !== null) {
            const s = state.get(faceId);
            if (s) s.baseline = { yaw: s.smoothYaw, pitch: s.smoothPitch };
        } else {
            state.forEach(s => { s.baseline = { yaw: s.smoothYaw, pitch: s.smoothPitch }; });
        }
    }

    function reset() {
        state.clear();
    }

    return {
        update,
        reset,
        calibrate,
        config: cfg,
        getMeterValue: () => meterValue,
        get state() { return publicState; },
    };
}
