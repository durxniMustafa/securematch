// src/modules/overlayRenderer.js

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20]
];

/**
 * Draws face boxes + hand skeleton, sizing the canvas
 * to the *video’s* resolution so that normalized coords
 * map correctly.
 */
export function drawOverlays(faces, hands, canvas, focusFaceId = null, gesture = null) {
    const ctx = canvas.getContext('2d');

    // Match the *source* video resolution, not the CSS size.
    // We assume video.videoWidth/Height are set.
    const video = document.querySelector('video');
    if (video && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    } else {
        // fallback
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- FACE BOXES ---
    faces.forEach((lm, i) => {
        // debug: log the first landmark
        if (i === 0) console.log('face[0][0]=', lm[0]);

        const xs = lm.map(p => p.x);
        const ys = lm.map(p => p.y);
        const x = Math.min(...xs) * canvas.width;
        const y = Math.min(...ys) * canvas.height;
        const w = (Math.max(...xs) - Math.min(...xs)) * canvas.width;
        const h = (Math.max(...ys) - Math.min(...ys)) * canvas.height;

        ctx.lineWidth = 4;
        ctx.strokeStyle = (i === focusFaceId)
            ? (gesture === 'yes' ? 'lime' : 'red')
            : 'white';
        ctx.strokeRect(x, y, w, h);
    });

    // --- HAND SKELETONS ---
    hands.forEach(lm => {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'cyan';
        HAND_CONNECTIONS.forEach(([a, b]) => {
            const p = lm[a];
            const q = lm[b];
            ctx.beginPath();
            ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
            ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
            ctx.stroke();
        });
        ctx.fillStyle = 'magenta';
        lm.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    });
}
