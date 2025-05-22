export function createCalibrator(options = {}) {
    const cfg = Object.assign({
        stillThresh: 0.03,
        stillFrames: 15,
        capFrames: 30,
    }, options);

    let state = 'WAIT_STABLE';
    let baseYaw = 0, basePitch = 0;
    let stillCount = 0;
    let capCount = 0;
    let sumYaw = 0, sumPitch = 0;
    let active = false;

    function start(yaw = 0, pitch = 0) {
        baseYaw = yaw;
        basePitch = pitch;
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
        active = false;
    }

    function update(yaw, pitch) {
        if (!active) {
            const dy = yaw - baseYaw;
            const dp = pitch - basePitch;
            const dist = Math.hypot(dy, dp);
            return { state, still: dist < cfg.stillThresh };
        }

        const dy = yaw - baseYaw;
        const dp = pitch - basePitch;
        const dist = Math.hypot(dy, dp);

        if (state === 'WAIT_STABLE') {
            if (dist < cfg.stillThresh) {
                stillCount++;
                if (stillCount >= cfg.stillFrames) {
                    state = 'CAPTURING';
                    capCount = 0;
                    sumYaw = 0;
                    sumPitch = 0;
                }
            } else {
                stillCount = 0;
                baseYaw = yaw;
                basePitch = pitch;
            }
            return { state, progress: stillCount / cfg.stillFrames, still: dist < cfg.stillThresh };
        }

        if (state === 'CAPTURING') {
            if (dist < cfg.stillThresh) {
                sumYaw += yaw;
                sumPitch += pitch;
                capCount++;
                if (capCount >= cfg.capFrames) {
                    baseYaw = sumYaw / capCount;
                    basePitch = sumPitch / capCount;
                    state = 'READY';
                    active = false;
                    return { state, baseline: { yaw: baseYaw, pitch: basePitch }, progress: 1, still: true };
                }
            } else {
                start(yaw, pitch);
            }
            return { state, progress: capCount / cfg.capFrames, still: dist < cfg.stillThresh };
        }

        return { state, baseline: { yaw: baseYaw, pitch: basePitch }, progress: 1, still: dist < cfg.stillThresh };
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
