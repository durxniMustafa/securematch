// Lightweight One Euro filter implementation
export function createOneEuroFilter({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    let xPrev = null;
    let dxPrev = 0;
    let tPrev = 0;
    function alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }
    return {
        update(x, nowMs) {
            if (xPrev === null) {
                xPrev = x;
                tPrev = nowMs;
                return x;
            }
            const dt = (nowMs - tPrev) / 1000 || 1/60;
            tPrev = nowMs;
            const dx = (x - xPrev) / dt;
            const aD = alpha(dCutoff, dt);
            const dxHat = aD * dx + (1 - aD) * dxPrev;
            const cutoff = minCutoff + beta * Math.abs(dxHat);
            const a = alpha(cutoff, dt);
            const xHat = a * x + (1 - a) * xPrev;
            xPrev = xHat;
            dxPrev = dxHat;
            return xHat;
        }
    };
}
