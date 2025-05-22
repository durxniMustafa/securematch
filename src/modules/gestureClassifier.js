// src/modules/gestureClassifier.js
// Head gesture classifier (nod = "yes", shake = "no") with adaptive baseline
// and runtime-configurable thresholds.

export const DEFAULT_THRESH_MBPRO = 0.06;

export function createClassifierMap(options = {}) {
    const cfg = Object.assign({
        yawThresh: 0.1,
        pitchThresh: 0.1,
        bufferMs: 700,
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
        // minimum ratio of the second swing relative to the first
        oppSwingRatio: 0.5,
        yawGuard: 0.06,
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

    function adaptBaseline(s) {
        s.baseline.yaw = 0.98 * s.baseline.yaw + 0.02 * s.smoothYaw;
        s.baseline.pitch = 0.98 * s.baseline.pitch + 0.02 * s.smoothPitch;
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
                    pitchHist: [pitch],
                    nodBuf: [],
                    currentPitchThresh: cfg.pitchThresh,
                    stageYaw: 0, tYaw1: 0, maxYaw: 0, yawDir: 0,
                    lastEmit: 0,
                    lastSeen: now,
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
            s.buf.push({ dyaw, dpitch, t: now });
            while (s.buf[0] && now - s.buf[0].t > cfg.bufferMs) s.buf.shift();

            adaptBaseline(s);

            s.pitchHist.push(s.smoothPitch);
            if (s.pitchHist.length > 30) s.pitchHist.shift();
            const meanPitch = s.pitchHist.reduce((a, b) => a + b, 0) / s.pitchHist.length;
            const varPitch = s.pitchHist.reduce((a, b) => a + (b - meanPitch) * (b - meanPitch), 0) / s.pitchHist.length;
            const sigma = Math.sqrt(varPitch);
            const pitchThresh = Math.max(0.08, 3 * sigma);
            s.currentPitchThresh = pitchThresh;

            s.nodBuf.push({ val: dpitch, t: now });
            while (s.nodBuf[0] && now - s.nodBuf[0].t > 700) s.nodBuf.shift();

            if (Math.abs(dyaw) <= cfg.yawGuard) {
                if (s.nodBuf.length) {
                    let peak = s.nodBuf[0];
                    let valley = s.nodBuf[0];
                    for (const o of s.nodBuf) {
                        if (o.val > peak.val) peak = o;
                        if (o.val < valley.val) valley = o;
                    }
                    const delta = peak.val - valley.val;
                    const dt = Math.abs(peak.t - valley.t);
                    if (delta >= pitchThresh && dt <= 700 && now - s.lastEmit > cfg.debounceMs) {
                        const conf = Math.min(1, delta / (pitchThresh * cfg.confidenceLinear));
                        gestures.push({ id, gesture: 'yes', confidence: conf });
                        s.lastEmit = now;
                        s.nodBuf = [];
                    }
                }
            } else {
                s.nodBuf = [];
            }

            if (cfg.deepDebug) {
                console.debug(`face ${id} dy=${dyaw.toFixed(3)} dp=${dpitch.toFixed(3)}`);
            }

            if (s.stageYaw === 0 && Math.abs(dyaw) > cfg.yawThresh) {
                s.stageYaw = 1;
                s.yawDir = Math.sign(dyaw);
                s.tYaw1 = now;
                s.maxYaw = Math.abs(dyaw);
            }
            if (s.stageYaw === 1 && Math.sign(dyaw) === -s.yawDir && now - s.tYaw1 >= cfg.swingMinMs) {
                const enough = Math.abs(dyaw) > cfg.yawThresh || Math.abs(dyaw) > s.maxYaw * cfg.oppSwingRatio;
                if (enough) {
                    s.stageYaw = 2;
                    s.maxYaw = Math.max(s.maxYaw, Math.abs(dyaw));
                }
            }
            if (s.stageYaw === 2 && Math.abs(dyaw) < cfg.baselineTol) { s.stageYaw = 3; }


            if (s.stageYaw === 3) {
                const maxPitch = Math.max(...s.buf.map(o => Math.abs(o.dpitch)));
                if (maxPitch < s.currentPitchThresh * cfg.axisVetoFactor && now - s.lastEmit > cfg.debounceMs) {
                    const conf = Math.min(1, s.maxYaw / (cfg.yawThresh * cfg.confidenceLinear));
                    gestures.push({ id, gesture: 'no', confidence: conf });
                    s.lastEmit = now;
                }
                s.stageYaw = 0;
                s.yawDir = 0;
                s.maxYaw = 0;
            }


            if (id === 0) {
                publicState = `Y${s.stageYaw}`;
            }
        });

        prune(now);
        return gestures;
    }

    function calibrate(faceId = null, baseline = null) {
        if (faceId !== null) {
            const s = state.get(faceId);
            if (s) {
                if (baseline) s.baseline = { yaw: baseline.yaw, pitch: baseline.pitch };
                else s.baseline = { yaw: s.smoothYaw, pitch: s.smoothPitch };
            }
        } else {
            state.forEach(s => {
                if (baseline) s.baseline = { yaw: baseline.yaw, pitch: baseline.pitch };
                else s.baseline = { yaw: s.smoothYaw, pitch: s.smoothPitch };
            });
        }
    }

    function reset() {
        state.clear();
        publicState = '';
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
