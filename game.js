// Konfigurasi Firebase - Ganti dengan config Anda
const firebaseConfig = {
  apiKey: "AIzaSyBFYi6jcbd9lN3yAI27GHfEaS3Bl7YR4KU",
  authDomain: "ulartangga-49686.firebaseapp.com",
  databaseURL: "https://ulartangga-49686-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ulartangga-49686",
  storageBucket: "ulartangga-49686.firebasestorage.app",
  messagingSenderId: "17550586022",
  appId: "1:17550586022:web:9d342c6a4f462807224467"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Konfigurasi Game
const snakesAndLadders = {
  // Tangga (bawah -> atas)
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81,
  // Ular (atas -> bawah)
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78
};

const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];
let myPlayerId = generatePlayerId();
let gameId = "GAME_001"; // ID room yang sama untuk semua pemain
let currentGame = null;
let myPlayerName = "";

// Elemen UI
const board = document.getElementById('board');
const statusElement = document.getElementById('status');
const playersElement = document.getElementById('players');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');

// Inisialisasi Papan
function initBoard() {
  board.innerHTML = '';
  
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNum = (row % 2 === 0) ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `cell-${cellNum}`;
      cell.textContent = cellNum;
      
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

function generatePlayerId() {
  return 'P-' + Math.random().toString(36).substr(2, 9);
}

function updatePlayersUI(players) {
  playersElement.innerHTML = '';
  Object.entries(players).forEach(([id, player], index) => {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-info';
    playerEl.innerHTML = `
      <div class="player-marker" style="background: ${player.color}"></div>
      <span>${player.name} ${id === myPlayerId ? '(Anda)' : ''} ${id === currentGame?.currentPlayer ? '🎮' : ''}</span>
    `;
    playersElement.appendChild(playerEl);
  });
}

function updatePlayerPositions(players) {
  document.querySelectorAll('.player').forEach(el => el.remove());
  
  Object.entries(players).forEach(([id, player]) => {
    const cell = document.getElementById(`cell-${player.position}`);
    if (cell) {
      const playerEl = document.createElement('div');
      playerEl.className = 'player';
      playerEl.style.backgroundColor = player.color;
      playerEl.textContent = id === myPlayerId ? 'YOU' : 'P';
      playerEl.title = `${player.name} (Posisi: ${player.position})`;
      cell.appendChild(playerEl);
    }
  });
}

// Event Listeners
startBtn.addEventListener('click', async () => {
  const playerName = prompt('Masukkan nama pemain:', `Player ${Object.keys(currentGame?.players || {}).length + 1}`);
  
  if (playerName) {
    myPlayerName = playerName;
    const playerCount = currentGame ? Object.keys(currentGame.players).length : 0;
    
    await db.ref(`games/${gameId}/players/${myPlayerId}`).set({
      name: playerName,
      position: 1,
      color: colors[playerCount % colors.length]
    });
    
    // Jika ini pemain pertama, set sebagai currentPlayer
    if (playerCount === 0) {
      await db.ref(`games/${gameId}/currentPlayer`).set(myPlayerId);
    }
    
    await db.ref(`games/${gameId}/gameStarted`).set(true);
  }
});

rollBtn.addEventListener('click', () => {
  if (currentGame?.currentPlayer === myPlayerId) {
    const dice = Math.floor(Math.random() * 6) + 1;
    const player = currentGame.players[myPlayerId];
    let newPosition = player.position + dice;
    
    db.ref(`games/${gameId}`).transaction(game => {
      if (!game) return null;
      
      // Update posisi pemain
      game.players[myPlayerId].position = newPosition >= 100 ? 100 : newPosition;
      game.diceValue = dice;
      
      // Cek jika menang
      if (newPosition >= 100) {
        setTimeout(() => {
          alert(`${player.name} menang! Game akan direset.`);
          // Reset semua pemain
          Object.keys(game.players).forEach(id => {
            game.players[id].position = 1;
          });
        }, 500);
      } 
      // Cek ular/tangga
      else if (snakesAndLadders[newPosition]) {
        game.players[myPlayerId].position = snakesAndLadders[newPosition];
      }
      
      // Ganti giliran
      const playerIds = Object.keys(game.players);
      const currentIdx = playerIds.indexOf(myPlayerId);
      game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
      
      return game;
    });
  }
});

// Listen perubahan game state
db.ref(`games/${gameId}`).on('value', (snapshot) => {
  currentGame = snapshot.val();
  
  if (!currentGame || !currentGame.players) {
    statusElement.textContent = "Game belum dimulai";
    startBtn.disabled = false;
    rollBtn.disabled = true;
    return;
  }
  
  updatePlayersUI(currentGame.players);
  updatePlayerPositions(currentGame.players);
  
  // Update status game
  if (!currentGame.gameStarted) {
    statusElement.textContent = "Menunggu pemain lain...";
    rollBtn.disabled = true;
  } 
  else if (currentGame.currentPlayer === myPlayerId) {
    statusElement.textContent = "Giliran Anda! Lempar dadu!";
    rollBtn.disabled = false;
  } 
  else {
    statusElement.textContent = `Menunggu ${currentGame.players[currentGame.currentPlayer]?.name || 'pemain lain'}...`;
    rollBtn.disabled = true;
  }
  
  if (currentGame.diceValue > 0) {
    statusElement.textContent += ` Dadu: ${currentGame.diceValue}`;
  }
  
  startBtn.disabled = !!currentGame.players[myPlayerId];
});

// Jalankan saat pertama load
initBoard();
