import { subscribe } from '../store.js';

const panel = document.getElementById('logPanel');

subscribe(state => {
  if (!panel) return;
  panel.innerHTML = state.logs
    .map(l => `<div>[${new Date(l.time).toLocaleTimeString()}] ${l.msg}</div>`) 
    .join('');
  panel.scrollTop = panel.scrollHeight;
});
