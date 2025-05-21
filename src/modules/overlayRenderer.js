// We'll draw face bounding boxes + hand skeleton on one canvas

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [0, 13], [13, 14], [14, 15], [15, 16],// Ring
    [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
];

export function drawOverlays(faces, hands, canvas, focusFaceId = null, gesture = null) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Face boxes
    faces.forEach((lm, i) => {
        const xs = lm.map(p => p.x);
        const ys = lm.map(p => p.y);
        const x = Math.min(...xs) * canvas.width;
        const y = Math.min(...ys) * canvas.height;
        const w = (Math.max(...xs) - Math.min(...xs)) * canvas.width;
        const h = (Math.max(...ys) - Math.min(...ys)) * canvas.height;

        ctx.lineWidth = 4;
        if (i === focusFaceId) {
            ctx.strokeStyle = (gesture === 'yes') ? 'lime' : 'red';
        } else {
            ctx.strokeStyle = 'white';
        }
        ctx.strokeRect(x, y, w, h);
    });

    // Hand skeletons
    hands.forEach(lm => {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'cyan';
        HAND_CONNECTIONS.forEach(([start, end]) => {
            const a = lm[start];
            const b = lm[end];
            ctx.beginPath();
            ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
            ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
            ctx.stroke();
        });
        // Draw circles for joints
        ctx.fillStyle = 'magenta';
        lm.forEach(pt => {
            const x = pt.x * canvas.width;
            const y = pt.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    });
}
