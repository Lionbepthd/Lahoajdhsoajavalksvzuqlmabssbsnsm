const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Izinkan semua domain (untuk testing)
    methods: ["GET", "POST"]
  }
});

// Konfigurasi Game
const MAX_PLAYERS = 4;
const BOARD_SIZE = 100;
const snakesAndLadders = {
  // Tangga
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81,
  // Ular
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78
};

let gameState = {
  players: {},
  currentPlayer: null,
  gameStarted: false,
  diceValue: 0
};

// Ping server agar tidak sleep
setInterval(() => {
  console.log("Keep-alive ping");
}, 300000);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Cek jika game penuh
  if (Object.keys(gameState.players).length >= MAX_PLAYERS) {
    socket.emit('gameFull');
    socket.disconnect();
    return;
  }

  // Tambahkan pemain baru
  gameState.players[socket.id] = {
    position: 1,
    color: getRandomColor(),
    name: `Player ${Object.keys(gameState.players).length + 1}`
  };

  // Set pemain pertama sebagai current player
  if (Object.keys(gameState.players).length === 1) {
    gameState.currentPlayer = socket.id;
  }

  io.emit('gameState', gameState);

  // Handle mulai game
  socket.on('startGame', () => {
    if (!gameState.gameStarted) {
      gameState.gameStarted = true;
      io.emit('gameStarted', gameState);
    }
  });

  // Handle lempar dadu
  socket.on('rollDice', () => {
    if (gameState.gameStarted && gameState.currentPlayer === socket.id) {
      const diceValue = Math.floor(Math.random() * 6) + 1;
      gameState.diceValue = diceValue;

      // Update posisi pemain
      let newPosition = gameState.players[socket.id].position + diceValue;
      if (newPosition > BOARD_SIZE) newPosition = BOARD_SIZE;
      if (snakesAndLadders[newPosition]) newPosition = snakesAndLadders[newPosition];

      gameState.players[socket.id].position = newPosition;

      // Cek jika menang
      if (newPosition === BOARD_SIZE) {
        io.emit('playerWon', { 
          playerId: socket.id, 
          name: gameState.players[socket.id].name 
        });
        resetGame();
        return;
      }

      // Ganti giliran
      const playerIds = Object.keys(gameState.players);
      const nextIndex = (playerIds.indexOf(socket.id) + 1 % playerIds.length;
      gameState.currentPlayer = playerIds[nextIndex];

      io.emit('gameState', gameState);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
    if (Object.keys(gameState.players).length === 0) resetGame();
  });
});

function resetGame() {
  gameState = {
    players: {},
    currentPlayer: null,
    gameStarted: false,
    diceValue: 0
  };
}

function getRandomColor() {
  const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];
  return colors[Object.keys(gameState.players).length % colors.length];
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
