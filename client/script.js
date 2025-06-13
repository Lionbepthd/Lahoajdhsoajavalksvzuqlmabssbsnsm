// Ganti dengan URL Render.com Anda
const SERVER_URL = 'https://ular-tangga-backend.onrender.com'; 

const socket = io(SERVER_URL);
const board = document.getElementById('board');
const statusElement = document.getElementById('status');
const playersList = document.getElementById('players-list');
const diceElement = document.getElementById('dice');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');
const serverStatus = document.getElementById('server-status');

let myId = null;
let gameState = null;

// Buat papan game
function createBoard() {
  board.innerHTML = '';
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNumber = row % 2 === 0 ? (row * 10) + col + 1 : (row * 10) + (9 - col) + 1;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = cellNumber;
      cell.id = `cell-${cellNumber}`;
      board.appendChild(cell);
    }
  }
}

// Update tampilan pemain
function updatePlayers() {
  playersList.innerHTML = '';
  Object.entries(gameState.players).forEach(([id, player]) => {
    const playerElement = document.createElement('div');
    playerElement.className = 'player-info';
    playerElement.innerHTML = `
      <div class="player-marker" style="background: ${player.color}"></div>
      <span>${player.name}${id === gameState.currentPlayer ? ' (Giliran)' : ''}</span>
    `;
    playersList.appendChild(playerElement);
  });
}

// Update posisi pemain
function updatePlayerPositions() {
  document.querySelectorAll('.player').forEach(el => el.remove());
  Object.entries(gameState.players).forEach(([id, player]) => {
    const cell = document.getElementById(`cell-${player.position}`);
    if (cell) {
      const playerElement = document.createElement('div');
      playerElement.className = 'player';
      playerElement.style.backgroundColor = player.color;
      playerElement.textContent = player.name.charAt(0);
      cell.appendChild(playerElement);
    }
  });
}

// Event listeners
startBtn.addEventListener('click', () => socket.emit('startGame'));
rollBtn.addEventListener('click', () => socket.emit('rollDice'));

// Socket.io handlers
socket.on('connect', () => {
  myId = socket.id;
  serverStatus.textContent = 'Terhubung ke server!';
  serverStatus.style.color = 'green';
  createBoard();
});

socket.on('gameState', (state) => {
  gameState = state;
  updatePlayers();
  updatePlayerPositions();
  
  if (!gameState.gameStarted) {
    statusElement.textContent = `Menunggu pemain... (${Object.keys(gameState.players).length}/4)`;
    startBtn.disabled = Object.keys(gameState.players).length < 2 || myId !== Object.keys(gameState.players)[0];
  } else {
    statusElement.textContent = gameState.currentPlayer === myId ? 
      'Giliranmu! Lempar dadu!' : 
      `Menunggu ${gameState.players[gameState.currentPlayer]?.name}...`;
  }
  rollBtn.disabled = gameState.currentPlayer !== myId;
  diceElement.textContent = gameState.diceValue ? `Dadu: ${gameState.diceValue}` : '';
});

socket.on('playerWon', (data) => {
  alert(`🎉 ${data.name} menang!`);
});

socket.on('disconnect', () => {
  serverStatus.textContent = 'Terputus dari server. Refresh halaman...';
  serverStatus.style.color = 'red';
});
