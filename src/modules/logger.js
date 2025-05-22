
export function initLogger(subscribe) {
  const panel = document.getElementById('logPanel');
  if (!panel) return;

  subscribe(state => {
    panel.innerHTML = state.logs
      .map(l => `<div>[${new Date(l.time).toLocaleTimeString()}] ${l.msg}</div>`)
      .join('');
    panel.scrollTop = panel.scrollHeight;
  });
}

