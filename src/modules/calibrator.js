export function createCalibrator(options = {}) {
    const cfg = Object.assign({
        stillThresh: 2,
        stillFrames: 10,
        capFrames: 30,
    }, options);

    let state = 'WAIT_STABLE';
    let baseYaw = 0, basePitch = 0;
    let stillCount = 0;
    let capCount = 0;
    let sumYaw = 0, sumPitch = 0;
    let smoothYaw = 0, smoothPitch = 0;
    let active = false;

    function start(yaw = 0, pitch = 0) {
        baseYaw = yaw;
        basePitch = pitch;
        smoothYaw = yaw;
        smoothPitch = pitch;
        stillCount = 0;
        capCount = 0;
        sumYaw = 0;
        sumPitch = 0;
        state = 'WAIT_STABLE';
        active = true;
    }

    function reset() {
        state = 'WAIT_STABLE';
        stillCount = 0;
        capCount = 0;
        sumYaw = 0;
        sumPitch = 0;
        smoothYaw = 0;
        smoothPitch = 0;
        active = false;
    }

    function update(yaw, pitch) {
        smoothYaw += (yaw - smoothYaw) * 0.4;
        smoothPitch += (pitch - smoothPitch) * 0.4;

        const dy = smoothYaw - baseYaw;
        const dp = smoothPitch - basePitch;
        const dist = Math.abs(dy) + Math.abs(dp);
        const moving = dist >= cfg.stillThresh;

        if (!active) {
            return { state, still: !moving };
        }

        if (state === 'WAIT_STABLE') {
            if (!moving) {
                stillCount++;
                if (stillCount >= cfg.stillFrames) {
                    state = 'CAPTURING';
                    capCount = 0;
                    sumYaw = 0;
                    sumPitch = 0;
                }
            } else {
                stillCount = 0;
                baseYaw = smoothYaw;
                basePitch = smoothPitch;
            }
            return { state, progress: stillCount / cfg.stillFrames, still: !moving };
        }

        if (state === 'CAPTURING') {
            if (!moving) {
                sumYaw += smoothYaw;
                sumPitch += smoothPitch;
                capCount++;
                if (capCount >= cfg.capFrames) {
                    baseYaw = sumYaw / capCount;
                    basePitch = sumPitch / capCount;
                    state = 'READY';
                    active = false;
                    return { state, baseline: { yaw: baseYaw, pitch: basePitch }, progress: 1, still: true };
                }
            } else {
                start(smoothYaw, smoothPitch);
            }
            return { state, progress: capCount / cfg.capFrames, still: !moving };
        }

        return { state, baseline: { yaw: baseYaw, pitch: basePitch }, progress: 1, still: !moving };
    }

    return {
        start,
        update,
        reset,
        get active() { return active; },
        get state() { return state; },
        get baseline() { return { yaw: baseYaw, pitch: basePitch }; }
    };
}
