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
let isHost = false;

// Elemen UI
const board = document.getElementById('board');
const statusElement = document.getElementById('status');
const playersElement = document.getElementById('players');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const submitUsername = document.getElementById('submitUsername');

// Tampilkan modal username saat pertama load
usernameModal.style.display = 'flex';

// Handle submit username
submitUsername.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    myPlayerName = username;
    usernameModal.style.display = 'none';
    initializeGame();
  } else {
    alert("Username tidak boleh kosong!");
  }
});

function initializeGame() {
  initBoard();
  setupGameListeners();
}

function generatePlayerId() {
  return 'P-' + Math.random().toString(36).substr(2, 9);
}

function initBoard() {
  board.innerHTML = '';
  
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNum = (row % 2 === 0) ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1);
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

function setupGameListeners() {
  // Cek apakah game sudah ada
  db.ref(`games/${gameId}`).once('value').then(snapshot => {
    if (!snapshot.exists()) {
      isHost = true;
      startBtn.disabled = false;
      statusElement.textContent = "Anda adalah host. Klik 'Mulai Game' untuk memulai!";
    } else {
      joinExistingGame();
    }
  });

  // Handle mulai game (hanya untuk host)
  startBtn.addEventListener('click', () => {
    if (isHost) {
      db.ref(`games/${gameId}`).set({
        players: {
          [myPlayerId]: createPlayerData()
        },
        currentPlayer: myPlayerId,
        diceValue: 0,
        gameStarted: false,
        hostId: myPlayerId
      });
    }
  });

  // Handle lempar dadu
  rollBtn.addEventListener('click', () => {
    if (currentGame?.currentPlayer === myPlayerId) {
      const dice = Math.floor(Math.random() * 6) + 1;
      rollDice(dice);
    }
  });

  // Listen perubahan game state
  db.ref(`games/${gameId}`).on('value', handleGameUpdate);
}

function createPlayerData() {
  return {
    name: myPlayerName,
    position: 1,
    color: colors[Object.keys(currentGame?.players || {}).length % colors.length],
    isHost: isHost
  };
}

function joinExistingGame() {
  db.ref(`games/${gameId}/players/${myPlayerId}`).set(createPlayerData());
  statusElement.textContent = "Bergabung ke game...";
}

function handleGameUpdate(snapshot) {
  currentGame = snapshot.val();
  
  if (!currentGame || !currentGame.players) {
    statusElement.textContent = "Game belum dimulai";
    startBtn.disabled = !isHost;
    rollBtn.disabled = true;
    return;
  }
  
  // Update UI pemain
  updatePlayersUI(currentGame.players);
  updatePlayerPositions(currentGame.players);
  
  // Jika pemain ini belum terdaftar, daftarkan
  if (!currentGame.players[myPlayerId]) {
    db.ref(`games/${gameId}/players/${myPlayerId}`).set(createPlayerData());
    return;
  }
  
  // Update status game
  if (!currentGame.gameStarted) {
    statusElement.textContent = `Menunggu host memulai... (${Object.keys(currentGame.players).length} pemain)`;
    rollBtn.disabled = true;
    startBtn.disabled = !currentGame.players[myPlayerId].isHost;
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
}

function updatePlayersUI(players) {
  playersElement.innerHTML = '';
  Object.entries(players).forEach(([id, player]) => {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-info';
    playerEl.innerHTML = `
      <div class="player-marker" style="background: ${player.color}"></div>
      <span>${player.name} 
        ${id === myPlayerId ? '(Anda)' : ''} 
        ${id === currentGame?.currentPlayer ? '🎮' : ''}
        ${player.isHost ? '👑' : ''}
      </span>
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

function rollDice(diceValue) {
  db.ref(`games/${gameId}`).transaction(game => {
    if (!game) return null;
    
    const player = game.players[myPlayerId];
    let newPosition = player.position + diceValue;
    let isWinner = false;
    
    // Cek jika menang
    if (newPosition >= 100) {
      newPosition = 100;
      isWinner = true;
    } 
    // Cek ular/tangga
    else if (snakesAndLadders[newPosition]) {
      newPosition = snakesAndLadders[newPosition];
    }
    
    // Update posisi
    game.players[myPlayerId].position = newPosition;
    game.diceValue = diceValue;
    
    // Ganti giliran
    const playerIds = Object.keys(game.players);
    const currentIdx = playerIds.indexOf(myPlayerId);
    game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
    
    // Jika game belum mulai, mulai sekarang
    if (!game.gameStarted) {
      game.gameStarted = true;
    }
    
    return game;
  }).then(() => {
    if (currentGame.players[myPlayerId].position >= 100) {
      setTimeout(() => {
        alert(`${myPlayerName} menang! Game akan direset.`);
        resetGame();
      }, 500);
    }
  });
}

function resetGame() {
  db.ref(`games/${gameId}/players`).transaction(players => {
    if (!players) return null;
    
    Object.keys(players).forEach(id => {
      players[id].position = 1;
    });
    
    return players;
  });
  
  db.ref(`games/${gameId}`).update({
    currentPlayer: myPlayerId,
    diceValue: 0,
    gameStarted: true
  });
}
