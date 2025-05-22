import { set, get, appendLog } from '../store.js';

let socket;
let retryDelay = 1000;
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

export function initChat() {
    function connect() {
        socket = new WebSocket(WS_URL);
        set({ wsConnected: false });
        socket.addEventListener('open', () => {
            console.log('WS client connected');

            appendLog('WS connected');

            appendLog('WebSocket connected');

            set({ wsConnected: true });
            retryDelay = 1000;
        });
        socket.addEventListener('message', handleMsg);
        socket.addEventListener('close', () => {
            console.warn('WS client disconnected, retrying in', retryDelay);

            appendLog('WS disconnected');

            appendLog(`WS disconnected; retrying in ${retryDelay / 1000}s`);

            set({ wsConnected: false });
            setTimeout(connect, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 10000);
        });
    }

    function handleMsg(e) {
        const data = JSON.parse(e.data);

        if (data.type === 'snapshot') {
            // load initial tallies
            set({ tally: data.tally });
            appendLog('Received snapshot');
            // data.chatHistory...
        }
        else if (data.type === 'vote') {
            const updated = { ...get().tally };
            for (const k in data.delta) {
                updated[k] = (updated[k] || 0) + data.delta[k];
            }
            set({ tally: updated });

            appendLog(`Vote update: ${JSON.stringify(data.delta)}`);

            appendLog(`Vote update: yes=${updated.yes} no=${updated.no}`);

        }
        else if (data.type === 'chat') {
            // new chat message
            console.log('[CHAT]', data.msg);
            appendLog(`Chat: ${data.msg}`);
        }
    }

    connect();
}

export function sendVote(gesture) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'vote', gesture }));
}

export function sendChat(msg) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'chat', msg }));
}
