// Install: npm install ws
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
let players = [];
let graph = []; // shared network

wss.on('connection', ws => {
    ws.id = Date.now() + Math.random();
    players.push(ws);

    ws.on('message', message => {
        // receive choice from client
        const data = JSON.parse(message);
        if(data.type === 'nodeChoice'){
            graph.push({id: Date.now(), player: ws.id, color: data.color, word: data.word});
            broadcast({type:'updateGraph', graph});
        }
    });

    ws.on('close', ()=>{
        players = players.filter(p=>p!==ws);
    });

    // send current graph to new player
    ws.send(JSON.stringify({type:'updateGraph', graph}));
});

function broadcast(msg){
    players.forEach(p=>p.send(JSON.stringify(msg)));
}

console.log("NeuroSync server running on ws://localhost:8080");
