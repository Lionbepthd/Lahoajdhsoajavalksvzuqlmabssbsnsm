import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Konfigurasi Firebase - Ganti dengan milik Anda
const firebaseConfig = {
  apiKey: "AIzaSyBFYi6jcbd9lN3yAI27GHfEaS3Bl7YR4KU",
  authDomain: "ulartangga-49686.firebaseapp.com",
  databaseURL: "https://ulartangga-49686-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ulartangga-49686",
  storageBucket: "ulartangga-49686.appspot.com",
  messagingSenderId: "17550586022",
  appId: "1:17550586022:web:9d342c6a4f462807224467",
  measurementId: "G-XHZBBQ8QX1"
};

// Inisialisasi Firebase dengan error handling
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  console.log("🔥 Firebase berhasil diinisialisasi!");
  
  // Test koneksi ke database
  const testRef = ref(db, 'connection_test');
  set(testRef, { status: "connected", timestamp: Date.now() })
    .then(() => console.log("✅ Test koneksi database berhasil!"))
    .catch(error => console.error("❌ Gagal konek ke database:", error));
} catch (error) {
  console.error("🔥 Error inisialisasi Firebase:", error);
  alert("Gagal menginisialisasi Firebase. Cek console untuk detail.");
}

// Konfigurasi Game
const snakesAndLadders = {
  // Tangga (bawah -> atas)
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81,
  // Ular (atas -> bawah)
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78
};

const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];
let myPlayerId = generatePlayerId();
let gameId = "MAIN_ROOM_V3"; // ID room yang sama untuk semua pemain
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

// Fungsi pembantu
function generatePlayerId() {
  return 'P-' + Math.random().toString(36).substr(2, 9);
}

function getNextColor() {
  return colors[Object.keys(currentGame?.players || {}).length % colors.length];
}

// Event Listeners
submitUsername.addEventListener('click', handleUsernameSubmit);
startBtn.addEventListener('click', handleStartGame);
rollBtn.addEventListener('click', handleRollDice);

async function handleUsernameSubmit() {
  const username = usernameInput.value.trim();
  if (username) {
    myPlayerName = username;
    usernameModal.style.display = 'none';
    await checkGameExists();
  } else {
    alert("Harap masukkan username!");
  }
}

async function checkGameExists() {
  if (!db) {
    alert("Database tidak terhubung. Coba refresh halaman.");
    return;
  }

  const gameRef = ref(db, `games/${gameId}`);
  
  try {
    onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        isHost = true;
        startBtn.disabled = false;
        statusElement.textContent = "Anda adalah host. Klik 'Mulai Game'!";
        initBoard();
      } else {
        joinGame();
      }
    }, { onlyOnce: true });
  } catch (error) {
    console.error("Error checking game:", error);
    statusElement.textContent = "Error menghubungkan ke server";
  }
}

async function joinGame() {
  if (!db) return;

  const playerRef = ref(db, `games/${gameId}/players/${myPlayerId}`);
  const playerData = {
    name: myPlayerName,
    position: 1,
    color: getNextColor(),
    isHost: false,
    joinedAt: Date.now()
  };

  try {
    await set(playerRef, playerData);
    console.log(`🎮 Pemain ${myPlayerName} bergabung ke game ${gameId}`);
    initBoard();
    setupGameListener();
  } catch (error) {
    console.error("Error joining game:", error);
    alert("Gagal bergabung ke game. Coba lagi.");
  }
}

function initBoard() {
  board.innerHTML = '';
  
  // Buat papan 10x10 (100 kotak)
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNum = (row % 2 === 0) ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `cell-${cellNum}`;
      cell.textContent = cellNum;
      
      // Tandai ular dan tangga
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

function setupGameListener() {
  if (!db) return;

  const gameRef = ref(db, `games/${gameId}`);
  
  onValue(gameRef, (snapshot) => {
    currentGame = snapshot.val();
    if (!currentGame) {
      console.log("Game tidak ditemukan. Membuat baru...");
      return;
    }
    
    updateGameUI();
    updatePlayersUI();
    updatePlayerPositions();
  });
}

function updateGameUI() {
  if (!currentGame.gameStarted) {
    statusElement.textContent = `Menunggu host memulai... (${Object.keys(currentGame.players).length} pemain)`;
    rollBtn.disabled = true;
    startBtn.disabled = !isHost;
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

function updatePlayersUI() {
  playersElement.innerHTML = '';
  Object.entries(currentGame.players).forEach(([id, player]) => {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-info';
    playerEl.innerHTML = `
      <div class="player-marker" style="background: ${player.color}"></div>
      <span>${player.name} 
        ${id === myPlayerId ? '(Anda)' : ''} 
        ${id === currentGame.currentPlayer ? '🎮' : ''}
        ${player.isHost ? '👑' : ''}
      </span>
    `;
    playersElement.appendChild(playerEl);
  });
}

function updatePlayerPositions() {
  document.querySelectorAll('.player').forEach(el => el.remove());
  
  Object.entries(currentGame.players).forEach(([id, player]) => {
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

async function handleStartGame() {
  if (!isHost || !db) return;

  const gameRef = ref(db, `games/${gameId}`);
  const playerRef = ref(db, `games/${gameId}/players/${myPlayerId}`);
  
  try {
    await set(playerRef, {
      name: myPlayerName,
      position: 1,
      color: getNextColor(),
      isHost: true,
      joinedAt: Date.now()
    });
    
    await update(gameRef, {
      currentPlayer: myPlayerId,
      diceValue: 0,
      gameStarted: true,
      hostId: myPlayerId,
      startedAt: Date.now()
    });
    
    console.log("🚀 Game dimulai oleh host!");
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Gagal memulai game. Coba lagi.");
  }
}

async function handleRollDice() {
  if (!db || currentGame?.currentPlayer !== myPlayerId) return;

  const dice = Math.floor(Math.random() * 6) + 1;
  const gameRef = ref(db, `games/${gameId}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return null;
      
      const player = game.players[myPlayerId];
      let newPosition = player.position + dice;
      let isWinner = false;
      
      // Cek jika menang
      if (newPosition >= 100) {
        newPosition = 100;
        isWinner = true;
      } 
      // Cek ular/tangga
      else if (snakesAndLadders[newPosition]) {
        newPosition = snakesAndladders[newPosition];
      }
      
      // Update posisi
      game.players[myPlayerId].position = newPosition;
      game.diceValue = dice;
      
      // Ganti giliran
      const playerIds = Object.keys(game.players);
      const currentIdx = playerIds.indexOf(myPlayerId);
      game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
      
      return game;
    });

    // Cek jika menang
    if (currentGame.players[myPlayerId].position >= 100) {
      setTimeout(() => {
        alert(`${myPlayerName} menang! Game akan direset.`);
        resetGame();
      }, 500);
    }
  } catch (error) {
    console.error("Error rolling dice:", error);
    alert("Gagal melempar dadu. Coba lagi.");
  }
}

async function resetGame() {
  if (!db) return;

  const playersRef = ref(db, `games/${gameId}/players`);
  
  try {
    await runTransaction(playersRef, (players) => {
      if (!players) return null;
      
      Object.keys(players).forEach(id => {
        players[id].position = 1;
      });
      
      return players;
    });
    
    await update(ref(db, `games/${gameId}`), {
      currentPlayer: myPlayerId,
      diceValue: 0,
      lastReset: Date.now()
    });
    
    console.log("🔄 Game direset!");
  } catch (error) {
    console.error("Error resetting game:", error);
    alert("Gagal mereset game. Coba lagi.");
  }
}
