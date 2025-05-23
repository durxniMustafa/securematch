export function createOneEuroFilter(options = {}) {
    const cfg = Object.assign({
        freq: 30,
        minCutoff: 1.0,
        beta: 0.0,
        dCutoff: 1.0
    }, options);

    let lastTs = 0;
    let xPrev = 0;
    let dxPrev = 0;

    function alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    function update(x, ts = performance.now()) {
        if (!lastTs) {
            lastTs = ts;
            xPrev = x;
            return x;
        }
        const dt = (ts - lastTs) / 1000;
        lastTs = ts;
        const aD = alpha(cfg.dCutoff, dt);
        const dx = (x - xPrev) / dt;
        dxPrev += aD * (dx - dxPrev);
        const cutoff = cfg.minCutoff + cfg.beta * Math.abs(dxPrev);
        const a = alpha(cutoff, dt);
        xPrev += a * (x - xPrev);
        return xPrev;
    }

    return { update };
}
