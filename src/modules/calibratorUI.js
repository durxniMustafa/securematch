export function initCalibratorUI() {
    const overlay = document.getElementById('calibOverlay');
    const ringEl = document.getElementById('calibRing');
    const circle = ringEl ? ringEl.querySelector('circle') : null;
    const textEl = document.getElementById('calibText');
    const toastEl = document.getElementById('toast');
    const infoEl = document.getElementById('devInfo');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    let circumference = 0;
    if (circle) {
        const r = parseFloat(circle.getAttribute('r')) || 0;
        circumference = 2 * Math.PI * r;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference;
    }

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

    function showOverlay(show) {
        if (!overlay) return;
        overlay.classList.toggle('hidden', !show);
    }

    function update(progress = 0, still = false) {
        if (circle) {
            const offset = circumference - circumference * progress;
            circle.style.strokeDashoffset = offset;
        }
        if (textEl) textEl.style.color = still ? 'limegreen' : 'red';
    }

    function updateInfo(text) {
        if (infoEl) {
            infoEl.textContent = text;
            infoEl.style.display = text ? 'block' : 'none';
        }
    }

    return { update, showOverlay, showToast, beep, updateInfo };
}
