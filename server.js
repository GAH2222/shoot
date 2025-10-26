// Deploy this to Render.com, Railway.app, or Glitch.com for FREE hosting
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Game state
const players = new Map();
const bullets = new Map();
let gameState = {
    roundStartTime: Date.now(),
    roundDuration: 300000, // 5 minutes
    roundActive: true
};
let bulletIdCounter = 0;

// Broadcast to all clients
function broadcast(data, exclude = null) {
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Check round end
function checkRoundEnd() {
    const elapsed = Date.now() - gameState.roundStartTime;
    if (elapsed >= gameState.roundDuration && gameState.roundActive) {
        gameState.roundActive = false;
        
        // Find winner
        let winner = null;
        let maxKills = -1;
        players.forEach((player, id) => {
            if (player.kills > maxKills) {
                maxKills = player.kills;
                winner = { id, name: player.name, kills: player.kills };
            }
        });
        
        broadcast({
            type: 'roundEnd',
            winner: winner,
            scores: Array.from(players.entries()).map(([id, p]) => ({
                id, name: p.name, kills: p.kills
            })).sort((a, b) => b.kills - a.kills)
        });
        
        // Reset after 10 seconds
        setTimeout(() => {
            gameState.roundStartTime = Date.now();
            gameState.roundActive = true;
            players.forEach(p => {
                p.kills = 0;
                p.deaths = 0;
            });
            broadcast({ type: 'roundStart' });
        }, 10000);
    }
}

setInterval(checkRoundEnd, 1000);

wss.on('connection', (ws) => {
    let playerId = null;
    console.log('Client connected. Total clients:', wss.clients.size);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    playerId = data.id;
                    players.set(playerId, {
                        id: playerId,
                        name: data.name || 'Player',
                        position: data.position || { x: 0, y: 2, z: 0 },
                        rotation: data.rotation || { x: 0, y: 0, z: 0 },
                        velocity: { x: 0, y: 0, z: 0 },
                        health: 100,
                        kills: 0,
                        deaths: 0,
                        lastShot: 0
                    });

                    // Send existing players to new player
                    ws.send(JSON.stringify({
                        type: 'init',
                        players: Array.from(players.values()),
                        roundTimeLeft: gameState.roundDuration - (Date.now() - gameState.roundStartTime)
                    }));

                    // Notify others
                    broadcast({
                        type: 'playerJoined',
                        player: players.get(playerId)
                    }, ws);
                    
                    console.log(`Player ${data.name} joined. Total players: ${players.size}`);
                    break;

                case 'move':
                    if (players.has(playerId)) {
                        const player = players.get(playerId);
                        player.position = data.position;
                        player.rotation = data.rotation;
                        player.velocity = data.velocity;

                        broadcast({
                            type: 'playerMoved',
                            id: playerId,
                            position: data.position,
                            rotation: data.rotation,
                            velocity: data.velocity
                        }, ws);
                    }
                    break;

                case 'shoot':
                    if (players.has(playerId)) {
                        const now = Date.now();
                        const player = players.get(playerId);
                        
                        if (now - player.lastShot < 100) break; // Fire rate limit
                        player.lastShot = now;

                        const bulletId = bulletIdCounter++;
                        bullets.set(bulletId, {
                            id: bulletId,
                            owner: playerId,
                            position: { ...data.position },
                            direction: { ...data.direction },
                            createdAt: now,
                            isRocket: data.isRocket || false
                        });

                        broadcast({
                            type: 'shot',
                            bulletId: bulletId,
                            playerId: playerId,
                            position: data.position,
                            direction: data.direction,
                            isRocket: data.isRocket || false
                        });

                        // Remove bullet after timeout
                        setTimeout(() => bullets.delete(bulletId), data.isRocket ? 5000 : 3000);
                    }
                    break;

                case 'hit':
                    if (players.has(data.targetId) && players.has(playerId)) {
                        const target = players.get(data.targetId);
                        target.health -= data.damage || 34;

                        if (target.health <= 0) {
                            target.health = 100;
                            target.deaths++;
                            players.get(playerId).kills++;

                            // Respawn
                            broadcast({
                                type: 'playerDied',
                                id: data.targetId,
                                killerId: playerId,
                                killerName: players.get(playerId).name
                            });

                            // Update target position to spawn
                            target.position = { 
                                x: Math.random() * 40 - 20, 
                                y: 2, 
                                z: Math.random() * 40 - 20 
                            };
                        } else {
                            broadcast({
                                type: 'playerHit',
                                id: data.targetId,
                                health: target.health
                            });
                        }
                    }
                    break;

                case 'explode':
                    broadcast({
                        type: 'explosion',
                        position: data.position,
                        radius: data.radius || 5
                    });
                    break;

                case 'chat':
                    if (players.has(playerId)) {
                        broadcast({
                            type: 'chat',
                            playerId: playerId,
                            name: players.get(playerId).name,
                            message: data.message.substring(0, 200) // Limit message length
                        });
                    }
                    break;
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (playerId && players.has(playerId)) {
            console.log(`Player ${players.get(playerId).name} left. Total players: ${players.size - 1}`);
            players.delete(playerId);
            broadcast({
                type: 'playerLeft',
                id: playerId
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Physics Shooter Server running on port ${PORT}`);
    console.log(`WebSocket server ready for connections`);
});

// Keep alive ping
setInterval(() => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.ping();
        }
    });
}, 30000);
