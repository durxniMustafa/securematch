const BUFFER_MS = 300;
const MIN_FRAMES = 3;

export function createHandGestureClassifier() {
    // handIndex -> array of { yThumb, yIndex, t }
    const map = new Map();

    return {
        update(hands) {
            const out = [];

            hands.forEach((lm, i) => {
                // landmarks[4] = thumb tip, [8] = index tip
                const yThumb = lm[4].y;
                const yIndex = lm[8].y;

                const buf = map.get(i) || [];
                buf.push({ yThumb, yIndex, t: performance.now() });

                // prune old entries > 300 ms
                while (buf.length && performance.now() - buf[0].t > BUFFER_MS) {
                    buf.shift();
                }
                map.set(i, buf);

                if (buf.length >= MIN_FRAMES) {
                    const last = buf[buf.length - 1];
                    if (last.yThumb < last.yIndex - 0.02) {
                        out.push({ id: i, gesture: 'thumbs_up' });
                    } else if (last.yThumb > last.yIndex + 0.02) {
                        out.push({ id: i, gesture: 'thumbs_down' });
                    }
                }
            });

            return out;
        }
    };
}
