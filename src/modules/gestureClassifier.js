/* ───────────────────────────────────────────────
   Head-gesture YES / NO classifier
   ─────────────────────────────────────────────── */

const YAW_THRESH = 0.06;   // shake amplitude  (increase → less sensitive)
const PITCH_THRESH = 0.06;   // nod   amplitude
const BUFFER_MS = 600;    // rolling buffer for axis-veto
const LOST_TIMEOUT_MS = 1000;   // remove face if unseen for this long
const SWING_MIN_MS = 180;    // left→right or down→up must last ≥ this
const BASELINE_TOL = 0.015;  // how close we must return to “neutral”

export function createClassifierMap({ deepDebug = false } = {}) {

    /* one slot per face-id */
    const state = new Map();

    /* — drop faces that left the frame — */
    function prune(now) {
        for (const [id, s] of state) {
            if (!s._seen && now - s.lastSeen > LOST_TIMEOUT_MS) {
                if (deepDebug) console.debug('(drop) face', id);
                state.delete(id);
            }
        }
    }

    /* — public update() — */
    function update(faces) {
        const now = performance.now();
        const gestures = [];

        /* mark everybody unseen */
        state.forEach(s => { s._seen = false; });

        faces.forEach((lm, id) => {

            /* absolute yaw / pitch */
            const yaw = lm[234].x - lm[454].x;
            const pitch = lm[10].y - lm[152].y;

            /* create slot on first sighting */
            let s = state.get(id);
            if (!s) {
                s = {
                    baseline: { yaw, pitch },
                    buf: [],
                    /* FSM */
                    stageYaw: 0, tYaw1: 0,
                    stagePitch: 0, tPitch1: 0,
                    voted: false,
                    lastSeen: now,
                };
                if (deepDebug) console.debug('(init) face', id,
                    'baseline yaw=', yaw.toFixed(3),
                    'pitch=', pitch.toFixed(3));
                state.set(id, s);
            }

            s._seen = true;
            s.lastSeen = now;

            const dyaw = yaw - s.baseline.yaw;
            const dpitch = pitch - s.baseline.pitch;

            /* rolling buffer (used for axis-veto) */
            s.buf.push({ dyaw, dpitch, t: now });
            while (s.buf[0] && now - s.buf[0].t > BUFFER_MS) s.buf.shift();

            if (s.voted) return;          // this face has already voted

            /* ───────── SHAKE (“NO”) FSM (0→1→2→3) ───────── */
            if (s.stageYaw === 0 && dyaw > YAW_THRESH) { s.stageYaw = 1; s.tYaw1 = now; }
            if (s.stageYaw === 1 && dyaw < -YAW_THRESH &&
                now - s.tYaw1 >= SWING_MIN_MS) { s.stageYaw = 2; }
            if (s.stageYaw === 2 && Math.abs(dyaw) < BASELINE_TOL) { s.stageYaw = 3; }

            /* ───────── NOD (“YES”) FSM (0→1→2→3) ───────── */
            if (s.stagePitch === 0 && dpitch < -PITCH_THRESH) { s.stagePitch = 1; s.tPitch1 = now; }
            if (s.stagePitch === 1 && dpitch > PITCH_THRESH &&
                now - s.tPitch1 >= SWING_MIN_MS) { s.stagePitch = 2; }
            if (s.stagePitch === 2 && Math.abs(dpitch) < BASELINE_TOL) { s.stagePitch = 3; }

            /* ───────── axis-veto & emit ───────── */
            if (s.stageYaw === 3) {
                const maxPitch = Math.max(...s.buf.map(o => Math.abs(o.dpitch)));
                if (maxPitch < PITCH_THRESH * 0.5) {
                    if (deepDebug) console.info('→ DETECTED NO (shake) face', id);
                    gestures.push({ id, gesture: 'no' });
                    s.voted = true;
                }
            }

            if (s.stagePitch === 3) {
                const maxYaw = Math.max(...s.buf.map(o => Math.abs(o.dyaw)));
                if (maxYaw < YAW_THRESH * 0.5) {
                    if (deepDebug) console.info('→ DETECTED YES (nod) face', id);
                    gestures.push({ id, gesture: 'yes' });
                    s.voted = true;
                }
            }
        });

        prune(now);
        return gestures;
    }

    /* — wipe everything (used by the Reset button) — */
    function reset() {
        state.clear();
        if (deepDebug) console.info('gestureClassifier.reset()');
    }

    return { update, reset };
}
