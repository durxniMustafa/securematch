export function initCalibratorUI() {
    const overlay = document.getElementById('calibOverlay');
    const ring = document.getElementById('calibProgress');
    const toastEl = document.getElementById('toast');
    const infoEl = document.getElementById('devInfo');
    const textEl = document.getElementById('calibText');
    const circumference = 352; // 2 * PI * r (r=56)
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

    return {
        update(progress, still) {
            if (ring) {
                ring.style.strokeDashoffset = circumference * (1 - progress);
            }
            if (overlay) {
                overlay.classList.toggle('hidden', progress >= 1);
            }
            if (textEl) {
                textEl.textContent = 'Bitte ruhig halten…';
            }
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
