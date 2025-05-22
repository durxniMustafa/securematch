// A simple global state + subscription system
const listeners = new Set();

// Kiosk state
const state = {
  mode: 'idle',
  question: '',
  deadline: 0,
  tally: { yes: 0, no: 0 },
  fps: 0,
  wsConnected: false,
  logs: []
};

export const subscribe = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const set = patch => {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
};

export const get = () => ({ ...state });

export const appendLog = msg => {
  state.logs.push({ msg, time: Date.now() });
  if (state.logs.length > 50) state.logs.shift();
  set({ logs: state.logs });
};
