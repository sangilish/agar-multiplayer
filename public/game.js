const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let players = {};
let foods = {};
let myPlayerId = null;
let camera = { x: 0, y: 0 };
let mouseX = 0;
let mouseY = 0;
let worldWidth = 3000;
let worldHeight = 3000;

const startMenu = document.getElementById('startMenu');
const playerNameInput = document.getElementById('playerName');
const playButton = document.getElementById('playButton');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverMessage = document.getElementById('gameOverMessage');
const respawnButton = document.getElementById('respawnButton');
const scoreElement = document.getElementById('scoreValue');
const leaderboardList = document.getElementById('leaderboardList');

function startGame() {
    const playerName = playerNameInput.value.trim() || 'Anonymous';
    startMenu.style.display = 'none';
    socket.emit('join', playerName);
}

playButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

respawnButton.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    startGame();
});

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

socket.on('gameSetup', (data) => {
    worldWidth = data.worldWidth;
    worldHeight = data.worldHeight;
    myPlayerId = data.playerId;
});

socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
    updateScore();
});

socket.on('updateFoods', (serverFoods) => {
    foods = serverFoods;
});

socket.on('foodEaten', (foodId) => {
    delete foods[foodId];
});

socket.on('playerEaten', (playerId) => {
    delete players[playerId];
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
});

socket.on('gameOver', (data) => {
    gameOverScreen.style.display = 'block';
    gameOverMessage.textContent = `You were eaten by ${data.eatenBy}!`;
});

socket.on('updateLeaderboard', (leaderboard) => {
    leaderboardList.innerHTML = '';
    leaderboard.forEach((player, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${player.name}</span><span>${player.score}</span>`;
        leaderboardList.appendChild(li);
    });
});

function updateScore() {
    if (myPlayerId && players[myPlayerId]) {
        scoreElement.textContent = Math.floor(players[myPlayerId].mass);
    }
}

function updateCamera() {
    if (myPlayerId && players[myPlayerId]) {
        const player = players[myPlayerId];
        camera.x = player.x - canvas.width / 2;
        camera.y = player.y - canvas.height / 2;
    }
}

function drawGrid() {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    
    for (let x = startX; x < camera.x + canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = startY; y < camera.y + canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(canvas.width, y - camera.y);
        ctx.stroke();
    }
}

function drawBorder() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 5;
    ctx.strokeRect(-camera.x, -camera.y, worldWidth, worldHeight);
}

function drawFood() {
    for (const foodId in foods) {
        const food = foods[foodId];
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x - camera.x, food.y - camera.y, food.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayers() {
    for (const playerId in players) {
        const player = players[playerId];
        
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x - camera.x, player.y - camera.y, player.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.font = `${Math.max(12, player.size / 5)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, player.x - camera.x, player.y - camera.y);
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updateCamera();
    drawGrid();
    drawBorder();
    drawFood();
    drawPlayers();
    
    if (myPlayerId && players[myPlayerId]) {
        const player = players[myPlayerId];
        const worldMouseX = mouseX + camera.x;
        const worldMouseY = mouseY + camera.y;
        
        socket.emit('move', { x: worldMouseX, y: worldMouseY });
    }
    
    requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

gameLoop();