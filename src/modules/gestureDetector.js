import { createOneEuroFilter } from './oneEuroFilter.js';
import { matrixToEuler } from './poseUtils.js';
import { GESTURE } from './gestureConfig.js';

export function createGestureDetector(options = {}) {
    const cfg = Object.assign({}, GESTURE, options);
    const state = new Map();
    let meterValue = 0;

    function get(id) {
        let s = state.get(id);
        if (!s) {
            s = {
                yawFilter: createOneEuroFilter(),
                pitchFilter: createOneEuroFilter(),
                yawPrev: 0,
                pitchPrev: 0,
                lastTs: 0,
                nodActive: false,
                nodDir: 0,
                nodPeak: 0,
                nodT: 0,
                shakeActive: false,
                shakeDir: 0,
                shakePeak: 0,
                shakeT: 0
            };
            state.set(id, s);
        }
        return s;
    }

    function update(results, timestamp = performance.now()) {
        const gestures = [];
        meterValue = 0;
        const faces = results.faceLandmarks || [];
        const matrices = results.facialTransformationMatrixes || [];
        faces.forEach((lm, id) => {
            const mat = matrices[id];
            if (!mat) return;
            const { yaw, pitch } = matrixToEuler(mat);
            const s = get(id);
            const y = s.yawFilter.update(yaw, timestamp);
            const p = s.pitchFilter.update(pitch, timestamp);
            const dt = s.lastTs ? (timestamp - s.lastTs) : 33;
            const yawVel = (y - s.yawPrev) / dt * 1000;
            const pitchVel = (p - s.pitchPrev) / dt * 1000;
            if (id === 0) {
                meterValue = Math.min(1, Math.abs(yawVel) / cfg.VEL_THRESH_DPS);
            }
            s.yawPrev = y;
            s.pitchPrev = p;
            s.lastTs = timestamp;

            // ----- NOD -----
            if (!s.nodActive && Math.abs(pitchVel) > cfg.VEL_THRESH_DPS) {
                s.nodActive = true;
                s.nodDir = Math.sign(pitchVel);
                s.nodPeak = p;
                s.nodT = timestamp;
            }
            if (s.nodActive) {
                if (Math.sign(pitchVel) === -s.nodDir && Math.abs(pitchVel) > cfg.VEL_THRESH_DPS) {
                    if (Math.abs(p - s.nodPeak) > cfg.NOD_THRESH_DEG &&
                        timestamp - s.nodT < cfg.WINDOW_MS.nod) {
                        gestures.push({ id, gesture: 'yes', confidence: 1 });
                    }
                    s.nodActive = false;
                } else if (timestamp - s.nodT > cfg.WINDOW_MS.nod) {
                    s.nodActive = false;
                }
            }

            // ----- SHAKE -----
            if (!s.shakeActive && Math.abs(yawVel) > cfg.VEL_THRESH_DPS) {
                s.shakeActive = true;
                s.shakeDir = Math.sign(yawVel);
                s.shakePeak = y;
                s.shakeT = timestamp;
            }
            if (s.shakeActive) {
                if (Math.sign(yawVel) === -s.shakeDir && Math.abs(yawVel) > cfg.VEL_THRESH_DPS) {
                    if (Math.abs(y - s.shakePeak) > cfg.SHAKE_THRESH_DEG &&
                        timestamp - s.shakeT < cfg.WINDOW_MS.shake) {
                        gestures.push({ id, gesture: 'no', confidence: 1 });
                    }
                    s.shakeActive = false;
                } else if (timestamp - s.shakeT > cfg.WINDOW_MS.shake) {
                    s.shakeActive = false;
                }
            }
        });
        return gestures;
    }

    function reset() { state.clear(); }

    return {
        update,
        reset,
        config: cfg,
        getMeterValue: () => meterValue
    };
}
