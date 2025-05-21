import { subscribe } from '../store.js';

export function initAttractor() {
    const attractorEl = document.getElementById('attractor');
    subscribe(state => {
        if (!attractorEl) return;
        if (state.mode === 'idle') {
            attractorEl.style.display = 'flex';
        } else {
            attractorEl.style.display = 'none';
        }
    });
}
