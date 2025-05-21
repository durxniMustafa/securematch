import { set, get } from '../store.js';

let socket;

export function initChat() {
    socket = new WebSocket('ws://localhost:4000');
    socket.addEventListener('open', () => {
        console.log('WS client connected');
    });
    socket.addEventListener('message', e => {
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
    });
    socket.addEventListener('close', () => {
        console.warn('WS client disconnected');
    });
}

export function sendVote(gesture) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'vote', gesture }));
}

export function sendChat(msg) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'chat', msg }));
}
