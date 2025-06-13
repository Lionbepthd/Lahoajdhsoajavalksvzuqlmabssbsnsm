// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB...", // Ganti dengan milikmu
  databaseURL: "https://ular-tangga-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variabel Game
let myPlayerId = generateId();
let gameId = "GAME_001"; // ID Room (bisa diganti)
let currentPlayer = null;

// Inisialisasi Papan
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

// Lempar Dadu
document.getElementById('rollBtn').addEventListener('click', () => {
  if (currentPlayer === myPlayerId) {
    const dice = Math.floor(Math.random() * 6) + 1;
    db.ref(`games/${gameId}/diceValue`).set(dice);
  }
});

// Listen Perubahan Game State
db.ref(`games/${gameId}`).on('value', (snapshot) => {
  const game = snapshot.val();
  if (!game) return;
  
  updateBoard(game);
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
