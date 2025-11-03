// server.js — multiplayer backend
const express = require('express');
const http = require('http');
const WebSocket = require('ws');  // assumes you use ws for WebSockets

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8080;

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Setup WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    console.log('Received:', data);
    // parse message and act (join lobby, start game, etc)
    // Example: broadcast to all clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
