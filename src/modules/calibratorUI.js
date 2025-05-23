export function initCalibratorUI() {
    const overlay = document.getElementById('calibOverlay');
    const ring = document.getElementById('calibProgress');

    const ring = document.getElementById('calibRing');
    const ringCircle = ring ? ring.querySelector('circle') : null;
    const textEl = document.getElementById('calibText');

    const toastEl = document.getElementById('toast');
    const infoEl = document.getElementById('devInfo');
    const overlay = document.getElementById('calibOverlay');
    const ring = document.getElementById('calibRing');
    const msgEl = document.getElementById('calibMsg');

    const textEl = document.getElementById('calibText');
    const circumference = 352; // 2 * PI * r (r=56)

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    let circumference = 0;
    if (ringCircle) {
        const r = parseFloat(ringCircle.getAttribute('r'));
        circumference = 2 * Math.PI * r;
        ringCircle.style.strokeDasharray = circumference;
        ringCircle.style.strokeDashoffset = circumference;
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

    function update(progress, still) {
        if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
        if (dot) dot.style.background = still ? 'limegreen' : 'red';
        if (ring) {
            const circ = 339.292; // 2*pi*r
            ring.style.strokeDashoffset = circ * (1 - progress);
        }
    }

    return {
        update,
        showOverlay,


    }

    function show() {
        if (overlay) overlay.style.display = 'flex';
        if (textEl) textEl.textContent = 'Bitte ruhig halten…';
    }

    function hide() {
        if (overlay) overlay.style.display = 'none';
        if (ringCircle) ringCircle.style.strokeDashoffset = circumference;
        if (textEl) textEl.textContent = '';

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
            show();
            if (ringCircle) {
                ringCircle.style.strokeDashoffset = circumference * (1 - progress);
                ringCircle.style.stroke = still ? 'limegreen' : 'tomato';
            }
        },
        show,
        hide,

        showToast,
        beep,
        updateInfo(text) {
            if (infoEl) {
                infoEl.textContent = text;
                infoEl.style.display = text ? 'block' : 'none';
            }
            if (msgEl) msgEl.textContent = text;
        }
    };
}
