const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 9999;

app.use(express.static(path.join(__dirname, '../public')));

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const FOOD_COUNT = 500;
const INITIAL_PLAYER_SIZE = 10;
const FOOD_SIZE = 5;
const PLAYER_SPEED = 3;

const players = {};
const foods = {};
let foodIdCounter = 0;

function generateRandomPosition() {
    return {
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT
    };
}

function generateRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E5'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createFood() {
    const food = {
        id: foodIdCounter++,
        ...generateRandomPosition(),
        color: generateRandomColor(),
        size: FOOD_SIZE
    };
    foods[food.id] = food;
    return food;
}

function initializeFoods() {
    for (let i = 0; i < FOOD_COUNT; i++) {
        createFood();
    }
}

function calculatePlayerSize(mass) {
    return Math.sqrt(mass) * 10;
}

function checkCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < obj1.size + obj2.size;
}

function getLeaderboard() {
    return Object.values(players)
        .sort((a, b) => b.mass - a.mass)
        .slice(0, 10)
        .map(player => ({
            name: player.name,
            score: Math.floor(player.mass)
        }));
}

initializeFoods();

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (playerName) => {
        const position = generateRandomPosition();
        players[socket.id] = {
            id: socket.id,
            name: playerName || `Player${Object.keys(players).length + 1}`,
            x: position.x,
            y: position.y,
            size: INITIAL_PLAYER_SIZE,
            color: generateRandomColor(),
            mass: 1,
            velocityX: 0,
            velocityY: 0
        };

        socket.emit('gameSetup', {
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
            playerId: socket.id
        });

        io.emit('updatePlayers', players);
        io.emit('updateFoods', foods);
        io.emit('updateLeaderboard', getLeaderboard());
    });

    socket.on('move', (mouseData) => {
        const player = players[socket.id];
        if (!player) return;

        const dx = mouseData.x - player.x;
        const dy = mouseData.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const speed = PLAYER_SPEED / Math.sqrt(player.mass);
            player.velocityX = (dx / distance) * speed;
            player.velocityY = (dy / distance) * speed;

            player.x += player.velocityX;
            player.y += player.velocityY;

            player.x = Math.max(player.size, Math.min(WORLD_WIDTH - player.size, player.x));
            player.y = Math.max(player.size, Math.min(WORLD_HEIGHT - player.size, player.y));
        }

        for (const foodId in foods) {
            const food = foods[foodId];
            if (checkCollision(player, food)) {
                player.mass += 0.1;
                player.size = calculatePlayerSize(player.mass);
                delete foods[foodId];
                createFood();
                io.emit('foodEaten', foodId);
                io.emit('updateFoods', foods);
            }
        }

        for (const otherPlayerId in players) {
            if (otherPlayerId === socket.id) continue;
            const otherPlayer = players[otherPlayerId];
            
            if (checkCollision(player, otherPlayer)) {
                if (player.size > otherPlayer.size * 1.1) {
                    player.mass += otherPlayer.mass * 0.8;
                    player.size = calculatePlayerSize(player.mass);
                    
                    io.to(otherPlayerId).emit('gameOver', {
                        eatenBy: player.name
                    });
                    
                    delete players[otherPlayerId];
                    io.emit('playerEaten', otherPlayerId);
                }
            }
        }

        io.emit('updatePlayers', players);
        io.emit('updateLeaderboard', getLeaderboard());
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
        io.emit('updateLeaderboard', getLeaderboard());
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});