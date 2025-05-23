export function createDebugOverlay(canvas) {
    const ctx = canvas.getContext('2d');
    const yawData = [];
    const pitchData = [];
    const MAX = 120; // ~2s at 60 fps

    function drawGraph(data, color, threshold, yOffset) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = (i / MAX) * canvas.width;
            const y = yOffset - data[i] * canvas.height * 0.25;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.beginPath();
        const t = yOffset - threshold * canvas.height * 0.25;
        ctx.moveTo(0, t);
        ctx.lineTo(canvas.width, t);
        ctx.stroke();
        ctx.beginPath();
        const t2 = yOffset + threshold * canvas.height * 0.25;
        ctx.moveTo(0, t2);
        ctx.lineTo(canvas.width, t2);
        ctx.stroke();
    }

    return {
        update(yawDot, pitchDot, state, cfg) {
            yawData.push(yawDot);
            pitchData.push(pitchDot);
            if (yawData.length > MAX) yawData.shift();
            if (pitchData.length > MAX) pitchData.shift();

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGraph(yawData, 'red', cfg.yVel, canvas.height * 0.25);
            drawGraph(pitchData, 'blue', cfg.pVel, canvas.height * 0.75);
            ctx.fillStyle = 'white';
            ctx.fillText(state, 4, 10);
        }
    };
}
