// src/modules/gestureClassifier.js
// Head gesture classifier (nod = "yes", shake = "no") with adaptive baseline
// and runtime-configurable thresholds.

export const DEFAULT_THRESH_MBPRO = 0.06;

export function createClassifierMap(options = {}) {
    const cfg = Object.assign({
        bufferMs: 700,
        lostTimeoutMs: 1000,
        smoothFactor: 0.4,
        deepDebug: false,
        minVis: 0.5,

        /* --- velocity-FSM numbers --- */
        pVel: 0.61,          // 35 °/s  (rad/s)  nod threshold
        yVel: 0.52,          // 30 °/s            shake threshold
        nodWindowMs: 600,    // max down→up
        shakeWindowMs: 700,  // max left→right

        guardYaw: 0.18,      // 10.3 °   static after calibration
        guardPitch: 0.22,    // 12.6 °
        refractoryMs: 600,   // lock-out after an emit
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
        /* baseline frozen after wizard */
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

                    // --- velocity-FSM state ---
                    nodState: 'idle', nodT0: 0, nodDir: 0,
                    shakeSwinging: false, shakeDir: 0, shakeT0: 0,
                    yawBuf: [], pitchBuf: [],
                    prevYaw: yaw,
                    prevPitch: pitch,
                    lastFrameTs: now,

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

            const dt = (now - s.lastFrameTs) / 1000 || 0.033;  // seconds
            s.lastFrameTs = now;

            const yawDot   = (s.smoothYaw   - s.prevYaw)   / dt;
            const pitchDot = (s.smoothPitch - s.prevPitch) / dt;
            s.prevYaw   = s.smoothYaw;
            s.prevPitch = s.smoothPitch;

            // rolling 10-frame mean abs yaw/pitch (for guard veto)
            s.yawBuf.push(Math.abs(dyaw));
            s.pitchBuf.push(Math.abs(dpitch));
            if (s.yawBuf.length   > 10) s.yawBuf.shift();
            if (s.pitchBuf.length > 10) s.pitchBuf.shift();
            const avgAbsYaw   = s.yawBuf.reduce((a,b)=>a+b,0)/s.yawBuf.length;
            const avgAbsPitch = s.pitchBuf.reduce((a,b)=>a+b,0)/s.pitchBuf.length;

            if (id === 0) meterValue = Math.abs(yawDot) / cfg.yVel;

            /* ===== YES / NOD FSM (Symmetric) ===== */
            switch (s.nodState) {
              case 'idle':
                // Look for the initial swing in either direction
                if (Math.abs(pitchDot) > cfg.pVel) {
                  s.nodState = 'nod_started';
                  s.nodDir = Math.sign(pitchDot);
                  s.nodT0 = now;
                }
                break;

              case 'nod_started':
                // Look for a strong swing in the opposite direction
                if (((s.nodDir < 0 && pitchDot > cfg.pVel) ||
                     (s.nodDir > 0 && pitchDot < -cfg.pVel)) &&
                    now - s.nodT0 < cfg.nodWindowMs) {
                  if (avgAbsYaw < cfg.guardYaw && now - s.lastEmit > cfg.refractoryMs) {
                    const conf = Math.min(1, Math.abs(pitchDot) / cfg.pVel);
                    gestures.push({ id, gesture: 'yes', confidence: conf });
                    s.lastEmit = now;
                  }
                  s.nodState = 'idle';
                } else if (now - s.nodT0 > cfg.nodWindowMs) {
                  s.nodState = 'idle';             // timeout
                }
                break;
            }

            /* ===== NO / SHAKE FSM ===== */
            if (!s.shakeSwinging && Math.abs(yawDot) > cfg.yVel) {
              s.shakeSwinging = true;
              s.shakeDir      = Math.sign(yawDot);
              s.shakeT0       = now;
            }
            if (s.shakeSwinging) {
              if (Math.sign(yawDot) === -s.shakeDir && Math.abs(yawDot) > cfg.yVel) {
                if (now - s.shakeT0 < cfg.shakeWindowMs &&
                    avgAbsPitch < cfg.guardPitch &&
                    now - s.lastEmit > cfg.refractoryMs) {
                  const conf = Math.min(1, Math.abs(yawDot) / cfg.yVel);
                  gestures.push({ id, gesture: 'no', confidence: conf });
                  s.lastEmit = now;
                }
                s.shakeSwinging = false;
              }
              if (now - s.shakeT0 > cfg.shakeWindowMs) s.shakeSwinging = false; // timeout
            }

            if (id === 0) {
                publicState = s.nodState + (s.shakeSwinging ? 'S' : '');
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
