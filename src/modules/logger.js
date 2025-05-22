
export function initLogger(subscribe) {
  const panel = document.getElementById('logPanel');
  if (!panel) return;

  subscribe(state => {
    panel.textContent = ''; // clear
    state.logs.forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      panel.appendChild(div);
    });
    panel.scrollTop = panel.scrollHeight;
  });
}
import { subscribe } from '../store.js';

const panel = document.getElementById('logPanel');

subscribe(state => {
  if (!panel) return;
  panel.innerHTML = state.logs
    .map(l => `<div>[${new Date(l.time).toLocaleTimeString()}] ${l.msg}</div>`) 
    .join('');
  panel.scrollTop = panel.scrollHeight;
});

