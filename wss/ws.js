const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const ws_server = new WebSocket.Server({ server });

let connectedClients = 0;

ws_server.on('connection', function connection(ws) {
    connectedClients++;

    ws_server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'clientsCount', count: connectedClients }));
        }
    });

    console.log('A new client has connected. Total clients:', connectedClients);

    ws.on('message', function incoming(message) {
        const selectedFoodName = message.toString('utf-8');

        console.log('A client picked:', selectedFoodName);
        
        ws_server.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'selectedFood', data: selectedFoodName }));
            }
        });
    });

    ws.on('close', function () {
        connectedClients--;

        ws_server.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'clientsCount', count: connectedClients }));
            }
        });

        console.log('A client has disconnected. Total clients:', connectedClients);
    });
});

server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});
