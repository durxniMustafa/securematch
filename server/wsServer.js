import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const wss = new WebSocketServer({ port: PORT });
let tally = { yes: 0, no: 0 };
let chatHistory = [];

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

wss.on('connection', ws => {
    // Upon new connection, send current tally & chat
    ws.send(JSON.stringify({ type: 'snapshot', tally, chatHistory }));

    ws.on('message', data => {
        let obj;
        try {
            obj = JSON.parse(data);
        } catch (err) {
            console.error('Invalid JSON from client:', err);
            return;
        }

        if (obj.type === 'vote') {
            // Increment tally
            if (obj.gesture === 'yes') tally.yes++;
            if (obj.gesture === 'no') tally.no++;
            // Broadcast the change
            broadcast({ type: 'vote', delta: { [obj.gesture]: 1 } });
        }
        else if (obj.type === 'chat') {
            chatHistory.push(obj.msg);
            broadcast({ type: 'chat', msg: obj.msg });
        }
    });
});

console.log(`WS server running on ws://localhost:${PORT}`);
