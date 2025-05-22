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
