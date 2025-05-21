// This handles nod/shake by checking pitch & yaw sign flips
const DEG = 1.5;       // Try a smaller threshold so gentle nods count
const BUFFER_MS = 300; // 300 ms buffer window

export function createClassifierMap() {
    // faceId -> array of {yaw, pitch, t}
    const map = new Map();

    return {
        update(faces) {
            const out = [];

            faces.forEach((lm, i) => {
                // Landmarks used for measuring yaw/pitch
                // e.g. 234=left jaw, 454=right jaw, 10=forehead, 152=chin
                const yaw = lm[234].x - lm[454].x;
                const pitch = lm[10].y - lm[152].y;

                const buf = map.get(i) || [];
                buf.push({ yaw, pitch, t: performance.now() });

                // prune old frames
                while (buf.length && performance.now() - buf[0].t > BUFFER_MS) {
                    buf.shift();
                }
                map.set(i, buf);

                const flippedYaw = (
                    Math.min(...buf.map(o => o.yaw)) < -DEG &&
                    Math.max(...buf.map(o => o.yaw)) > DEG
                );
                const flippedPitch = (
                    Math.min(...buf.map(o => o.pitch)) < -DEG &&
                    Math.max(...buf.map(o => o.pitch)) > DEG
                );

                if (flippedYaw) out.push({ id: i, gesture: 'no' });
                if (flippedPitch) out.push({ id: i, gesture: 'yes' });
            });

            return out;
        }
    };
}
