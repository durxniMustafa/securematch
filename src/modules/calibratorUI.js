export function initCalibratorUI() {
    const bar = document.getElementById('calibBar');
    const dot = document.getElementById('calibDot');
    const toastEl = document.getElementById('toast');
    const infoEl = document.getElementById('devInfo');
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
        toastEl.style.display = 'block';
        setTimeout(() => {
            toastEl.style.display = 'none';
        }, 1500);
    }

    return {
        update(progress, still) {
            if (bar) bar.style.setProperty('--progress', `${Math.round(progress * 100)}%`);
            if (dot) dot.style.background = still ? 'limegreen' : 'red';
        },
        showToast,
        beep,
        updateInfo(text) {
            if (infoEl) {
                infoEl.textContent = text;
                infoEl.style.display = text ? 'block' : 'none';
            }
        }
    };
}
