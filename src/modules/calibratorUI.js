export function initCalibratorUI() {
    const bar = document.getElementById('calibBar');
    const dot = document.getElementById('calibDot');
    const toastEl = document.getElementById('toast');
    const infoEl = document.getElementById('devInfo');
    const overlay = document.getElementById('calibOverlay');
    const ring = document.getElementById('calibProgress');
    const textEl = document.getElementById('calibText');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function beep() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        osc.stop(audioCtx.currentTime + 0.2);
    }

    function showToast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.opacity = '1';
        toastEl.style.display = 'block';
        setTimeout(() => {
            toastEl.style.opacity = '0';
            setTimeout(() => {
                toastEl.style.display = 'none';
                toastEl.style.opacity = '1';
            }, 300);
        }, 1000);
    }

    function showOverlay() {
        if (overlay) overlay.classList.remove('hidden');
    }

    function hideOverlay() {
        if (overlay) overlay.classList.add('hidden');
    }

    function setText(msg) {
        if (textEl) textEl.textContent = msg;
    }

    function updateRing(p) {
        if (ring) {
            const max = 339; // circumference
            ring.style.strokeDashoffset = max - max * p;
        }
    }

    return {
        update(progress, still) {
            if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
            if (dot) dot.style.background = still ? 'limegreen' : 'red';
            updateRing(progress);
        },
        showToast,
        showOverlay,
        hideOverlay,
        setText,
        beep,
        updateInfo(text) {
            if (infoEl) {
                infoEl.textContent = text;
                infoEl.style.display = text ? 'block' : 'none';
            }
        }
    };
}
