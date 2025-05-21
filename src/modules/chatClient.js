import { set, get } from '../store.js';

let socket;
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

export function initChat() {
    function connect() {
        socket = new WebSocket(WS_URL);
        socket.addEventListener('open', () => {
            console.log('WS client connected');
        });
        socket.addEventListener('message', handleMsg);
        socket.addEventListener('close', () => {
            console.warn('WS client disconnected, retrying...');
            setTimeout(connect, 1000);
        });
    }

    function handleMsg(e) {
        const data = JSON.parse(e.data);

        if (data.type === 'snapshot') {
            // load initial tallies
            set({ tally: data.tally });
            // data.chatHistory...
        }
        else if (data.type === 'vote') {
            const updated = { ...get().tally };
            for (const k in data.delta) {
                updated[k] = (updated[k] || 0) + data.delta[k];
            }
            set({ tally: updated });
        }
        else if (data.type === 'chat') {
            // new chat message
            console.log('[CHAT]', data.msg);
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
