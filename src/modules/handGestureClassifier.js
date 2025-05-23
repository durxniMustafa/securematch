const BUFFER_MS = 300;
const MIN_FRAMES = 3;
const THRESH = 0.04;           // min diff between thumb & index
const DEBOUNCE_MS = 500;       // avoid spamming gestures

export function createHandGestureClassifier() {
    // handIndex -> { buf: [{diff, t}], lastEmit }
    const map = new Map();

    return {
        update(hands) {
            const out = [];
            const now = performance.now();

            hands.forEach((lm, i) => {
                const diff = lm[4].y - lm[8].y; // thumb tip - index tip
                const horiz = Math.abs(lm[4].x - lm[8].x);

                let state = map.get(i);
                if (!state) state = { buf: [], lastEmit: 0 };
                state.buf.push({ diff, t: now });

                // prune old entries
                while (state.buf.length && now - state.buf[0].t > BUFFER_MS) {
                    state.buf.shift();
                }
                map.set(i, state);

                if (state.buf.length >= MIN_FRAMES) {
                    const avg = state.buf.reduce((s, b) => s + b.diff, 0) / state.buf.length;
                    const conf = Math.min(1, Math.abs(avg) / (THRESH * 2));
                    if (horiz < 0.1 && avg < -THRESH && now - state.lastEmit > DEBOUNCE_MS) {
                        out.push({ id: i, gesture: 'thumbs_up', confidence: conf });
                        state.lastEmit = now;
                    } else if (horiz < 0.1 && avg > THRESH && now - state.lastEmit > DEBOUNCE_MS) {
                        out.push({ id: i, gesture: 'thumbs_down', confidence: conf });
                        state.lastEmit = now;
                    }
                }
            });

            // remove stale hand states
            map.forEach((_, key) => {
                if (!hands[key]) map.delete(key);
            });

            return out;
        },

        reset() {
            map.clear();
        }
    };
}
