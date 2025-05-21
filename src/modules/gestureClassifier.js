// src/modules/gestureClassifier.js
// Head gesture classifier (nod = "yes", shake = "no") with adaptive baseline
// and runtime-configurable thresholds.

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
        deepDebug: false,
    }, options);

    const state = new Map();

    function prune(now) {
        for (const [id, s] of state) {
            if (!s._seen && now - s.lastSeen > cfg.lostTimeoutMs) {
                state.delete(id);
            }
        }
    }

    function getYawPitch(lm, prevYaw, prevPitch) {
        let yaw = prevYaw, pitch = prevPitch;
        if (lm[234]?.visibility >= 0.5 && lm[454]?.visibility >= 0.5) {
            yaw = lm[234].x - lm[454].x;
        }
        if (lm[10]?.visibility >= 0.5 && lm[152]?.visibility >= 0.5) {
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
            }
        } else {
            s.steadySince = 0;
        }
    }

    function update(faces) {
        const now = performance.now();
        const gestures = [];
        state.forEach(s => { s._seen = false; });

        faces.forEach((lm, id) => {
            let s = state.get(id);
            if (!s) {
                const yaw = lm[234].x - lm[454].x;
                const pitch = lm[10].y - lm[152].y;
                s = {
                    baseline: { yaw, pitch },
                    lastYaw: yaw,
                    lastPitch: pitch,
                    buf: [],
                    stageYaw: 0, tYaw1: 0,
                    stagePitch: 0, tPitch1: 0,
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

            const dyaw = yaw - s.baseline.yaw;
            const dpitch = pitch - s.baseline.pitch;
            s.buf.push({ dyaw, dpitch, t: now });
            while (s.buf[0] && now - s.buf[0].t > cfg.bufferMs) s.buf.shift();

            adaptBaseline(s, yaw, pitch, now);

            if (cfg.deepDebug) {
                console.debug(`face ${id} dy=${dyaw.toFixed(3)} dp=${dpitch.toFixed(3)}`);
            }

            if (s.stageYaw === 0 && dyaw > cfg.yawThresh) { s.stageYaw = 1; s.tYaw1 = now; }
            if (s.stageYaw === 1 && dyaw < -cfg.yawThresh && now - s.tYaw1 >= cfg.swingMinMs) { s.stageYaw = 2; }
            if (s.stageYaw === 2 && Math.abs(dyaw) < cfg.baselineTol) { s.stageYaw = 3; }

            if (s.stagePitch === 0 && dpitch < -cfg.pitchThresh) { s.stagePitch = 1; s.tPitch1 = now; }
            if (s.stagePitch === 1 && dpitch > cfg.pitchThresh && now - s.tPitch1 >= cfg.swingMinMs) { s.stagePitch = 2; }
            if (s.stagePitch === 2 && Math.abs(dpitch) < cfg.baselineTol) { s.stagePitch = 3; }

            if (s.stageYaw === 3) {
                const maxPitch = Math.max(...s.buf.map(o => Math.abs(o.dpitch)));
                if (maxPitch < cfg.pitchThresh * cfg.axisVetoFactor && now - s.lastEmit > cfg.debounceMs) {
                    gestures.push({ id, gesture: 'no' });
                    s.lastEmit = now;
                }
                s.stageYaw = 0;
            }

            if (s.stagePitch === 3) {
                const maxYaw = Math.max(...s.buf.map(o => Math.abs(o.dyaw)));
                if (maxYaw < cfg.yawThresh * cfg.axisVetoFactor && now - s.lastEmit > cfg.debounceMs) {
                    gestures.push({ id, gesture: 'yes' });
                    s.lastEmit = now;
                }
                s.stagePitch = 0;
            }
        });

        prune(now);
        return gestures;
    }

    function calibrate(faceId = null) {
        if (faceId !== null) {
            const s = state.get(faceId);
            if (s) s.baseline = { yaw: s.lastYaw, pitch: s.lastPitch };
        } else {
            state.forEach(s => { s.baseline = { yaw: s.lastYaw, pitch: s.lastPitch }; });
        }
    }

    function reset() {
        state.clear();
    }

    return { update, reset, calibrate, config: cfg };
}
