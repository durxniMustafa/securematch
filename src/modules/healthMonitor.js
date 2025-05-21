import { subscribe } from '../store.js';

const statusEl = document.getElementById('wsStatus');

subscribe(state => {
    if (!statusEl) return;
    if (state.wsConnected) {
        statusEl.textContent = 'Online';
        statusEl.classList.add('connected');
        statusEl.classList.remove('disconnected');
    } else {
        statusEl.textContent = 'Reconnecting...';
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
    }
});
