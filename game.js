// Tambahkan di bagian atas game.js
const snakesAndLadders = {
  // Tangga (bawah -> atas)
  4: 14,
  9: 31, 
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  
  // Ular (atas -> bawah)
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78
};
// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBFYi6jcbd9lN3yAI27GHfEaS3Bl7YR4KU", // Ganti dengan milikmu
  databaseURL: "https://ulartangga-49686-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variabel Game
let myPlayerId = generateId();
let gameId = "GAME_001"; // ID Room (bisa diganti)
let currentPlayer = null;

function initBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNum = (row % 2 === 0) ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `cell-${cellNum}`;
      cell.textContent = cellNum;
      
      // Tambahkan class khusus untuk ular/tangga
      if (snakesAndLadders[cellNum]) {
        cell.classList.add(
          snakesAndLadders[cellNum] > cellNum ? 'ladder' : 'snake'
        );
        cell.title = `Dari ${cellNum} ke ${snakesAndLadders[cellNum]}`;
      }
      
      board.appendChild(cell);
    }
  }
}

// Generate ID Pemain
function generateId() {
  return 'P-' + Math.random().toString(36).substr(2, 9);
}

// Mulai Game
document.getElementById('startBtn').addEventListener('click', () => {
  db.ref(`games/${gameId}`).set({
    players: {
      [myPlayerId]: {
        name: `Player ${Object.keys(players).length + 1}`,
        position: 1,
        color: getRandomColor()
      }
    },
    currentPlayer: myPlayerId,
    diceValue: 0
  });
});

// Modifikasi event listener rollBtn
document.getElementById('rollBtn').addEventListener('click', () => {
  if (currentPlayer === myPlayerId) {
    const dice = Math.floor(Math.random() * 6) + 1;
    
    db.ref(`games/${gameId}`).transaction(game => {
      if (!game) return game;
      
      // Update posisi pemain
      const player = game.players[myPlayerId];
      let newPosition = player.position + dice;
      
      // Cek jika melebihi 100
      if (newPosition > 100) newPosition = 100;
      
      // Cek ular/tangga
      if (snakesAndLadders[newPosition]) {
        newPosition = snakesAndLadders[newPosition];
      }
      
      // Update posisi
      game.players[myPlayerId].position = newPosition;
      game.diceValue = dice;
      
      // Ganti giliran (sederhana: round-robin)
      const playerIds = Object.keys(game.players);
      const currentIdx = playerIds.indexOf(game.currentPlayer);
      game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
      
      return game;
    });
  }
});

// Update Papan
function updateBoard(game) {
  // Update posisi pemain
  Object.entries(game.players).forEach(([id, player]) => {
    const cell = document.getElementById(`cell-${player.position}`);
    if (cell) {
      // Hapus player lama
      const oldPlayer = cell.querySelector('.player');
      if (oldPlayer) oldPlayer.remove();
      
      // Tambah player baru
      const playerEl = document.createElement('div');
      playerEl.className = 'player';
      playerEl.style.backgroundColor = player.color;
      playerEl.textContent = id === myPlayerId ? 'YOU' : 'P';
      cell.appendChild(playerEl);
    }
  });
  
  // Update status
  document.getElementById('status').textContent = 
    (game.currentPlayer === myPlayerId) ? "Giliran Anda!" : "Menunggu pemain lain...";
  
  document.getElementById('rollBtn').disabled = game.currentPlayer !== myPlayerId;
}

// Warna acak untuk pemain
function getRandomColor() {
  return `hsl(${Math.random() * 360}, 70%, 60%)`;
}

// Jalankan saat pertama load
initBoard();
