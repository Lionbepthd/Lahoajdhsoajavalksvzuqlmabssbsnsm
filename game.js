import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, get, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game Configuration
const snakesAndLadders = {
  // Ladders (bottom -> top)
  4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81,
  // Snakes (top -> bottom)
  17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78
};

const MAX_PLAYERS_PER_ROOM = 4;
const INACTIVITY_TIMEOUT = 10000; // 10 seconds
const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107'];

let myPlayerId = generatePlayerId();
let gameId = null;
let currentGame = null;
let myPlayerName = "";
let isHost = false;
let inactivityTimer;

// DOM Elements
const board = document.getElementById('board');
const statusElement = document.getElementById('status');
const playersElement = document.getElementById('players');
const startBtn = document.getElementById('startBtn');
const rollBtn = document.getElementById('rollBtn');
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const submitUsername = document.getElementById('submitUsername');
const roomModal = document.getElementById('roomModal');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomInfoModal = document.getElementById('roomInfoModal');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const roomStatusDisplay = document.getElementById('roomStatusDisplay');
const roomPlayersList = document.getElementById('roomPlayersList');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const startGameBtn = document.getElementById('startGameBtn');
const notification = document.getElementById('notification');

// Helper Functions
function generatePlayerId() {
  return 'P-' + Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getNextColor() {
  if (!currentGame?.players) return colors[0];
  return colors[Object.keys(currentGame.players).length % colors.length];
}

function showNotification(message, duration = 3000) {
  notification.textContent = message;
  notification.style.display = 'block';
  setTimeout(() => {
    notification.style.display = 'none';
  }, duration);
}

// Room Management
async function createNewRoom() {
  const roomCode = generateRoomCode();
  gameId = roomCode;
  isHost = true;
  
  try {
    await set(ref(db, `games/${roomCode}`), {
      roomCode,
      players: {},
      status: 'waiting',
      createdAt: Date.now(),
      hostId: myPlayerId,
      lastActivity: Date.now()
    });
    
    await joinRoom(roomCode);
    showRoomInfo(roomCode);
    startInactivityTimer();
    showNotification(`Room ${roomCode} created!`);
  } catch (error) {
    console.error("Error creating room:", error);
    showNotification("Failed to create room. Please try again.");
  }
}

async function joinRoom(roomCode) {
  const roomRef = ref(db, `games/${roomCode}`);
  const roomSnapshot = await get(roomRef);
  
  if (!roomSnapshot.exists()) {
    showNotification("Room not found!");
    return false;
  }
  
  const roomData = roomSnapshot.val();
  
  if (Object.keys(roomData.players).length >= MAX_PLAYERS_PER_ROOM) {
    showNotification("Room is full! Please create a new one.");
    return false;
  }
  
  if (roomData.status !== 'waiting') {
    showNotification("Game already started in this room!");
    return false;
  }
  
  gameId = roomCode;
  
  const playerRef = ref(db, `games/${roomCode}/players/${myPlayerId}`);
  await set(playerRef, {
    name: myPlayerName,
    position: 1,
    color: getNextColor(),
    isHost: false,
    joinedAt: Date.now(),
    lastActive: Date.now()
  });
  
  showNotification(`Joined room ${roomCode}`);
  return true;
}

function showRoomInfo(roomCode) {
  roomCodeDisplay.textContent = roomCode;
  roomStatusDisplay.textContent = 'Waiting for players...';
  startGameBtn.style.display = isHost ? 'block' : 'none';
  roomInfoModal.style.display = 'flex';
  updateRoomPlayersList();
}

function updateRoomPlayersList() {
  if (!currentGame?.players) return;
  
  roomPlayersList.innerHTML = '';
  Object.entries(currentGame.players).forEach(([id, player]) => {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-info';
    playerEl.innerHTML = `
      <div class="player-marker" style="background: ${player.color}"></div>
      <span>${player.name} ${id === myPlayerId ? '(You)' : ''} ${player.isHost ? '👑' : ''}</span>
    `;
    roomPlayersList.appendChild(playerEl);
  });
}

// Inactivity Timer
function startInactivityTimer() {
  resetInactivityTimer();
  
  // Update last active timestamp periodically
  setInterval(() => {
    if (currentGame && myPlayerId) {
      const playerRef = ref(db, `games/${gameId}/players/${myPlayerId}`);
      update(playerRef, { lastActive: Date.now() });
    }
  }, 3000);
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  
  inactivityTimer = setTimeout(() => {
    checkInactivePlayers();
  }, INACTIVITY_TIMEOUT);
}

async function checkInactivePlayers() {
  if (!gameId) return;
  
  const roomRef = ref(db, `games/${gameId}`);
  const roomSnapshot = await get(roomRef);
  
  if (!roomSnapshot.exists()) return;
  
  const roomData = roomSnapshot.val();
  const now = Date.now();
  
  // Check if host is inactive
  if (isHost && now - roomData.lastActivity > INACTIVITY_TIMEOUT) {
    endGameDueToInactivity();
    return;
  }
  
  // Check players inactivity
  for (const [playerId, player] of Object.entries(roomData.players)) {
    if (now - player.lastActive > INACTIVITY_TIMEOUT) {
      if (playerId === roomData.currentPlayer) {
        skipInactivePlayer();
      }
      return;
    }
  }
  
  resetInactivityTimer();
}

async function skipInactivePlayer() {
  try {
    await runTransaction(ref(db, `games/${gameId}`), (game) => {
      if (!game) return null;
      
      const playerIds = Object.keys(game.players);
      const currentIdx = playerIds.indexOf(game.currentPlayer);
      game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
      game.diceValue = 0;
      game.lastActivity = Date.now();
      
      return game;
    });
    
    showNotification("Inactive player skipped!");
  } catch (error) {
    console.error("Error skipping player:", error);
  }
}

async function endGameDueToInactivity() {
  statusElement.textContent = "Game ended due to inactivity";
  
  try {
    // Notify players
    showNotification("Game ended due to inactivity");
    
    // Remove the room
    await remove(ref(db, `games/${gameId}`));
    
    // Reset UI
    resetGameUI();
  } catch (error) {
    console.error("Error ending game:", error);
  }
}

// Game Initialization
function initBoard() {
  board.innerHTML = '';
  
  // Create 10x10 board (100 cells)
  for (let row = 9; row >= 0; row--) {
    for (let col = 0; col < 10; col++) {
      const cellNum = (row % 2 === 0) ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `cell-${cellNum}`;
      cell.textContent = cellNum;
      
      // Mark snakes and ladders
      if (snakesAndLadders[cellNum]) {
        cell.classList.add(
          snakesAndLadders[cellNum] > cellNum ? 'ladder' : 'snake'
        );
        cell.title = `From ${cellNum} to ${snakesAndLadders[cellNum]}`;
      }
      
      board.appendChild(cell);
    }
  }
}

function setupGameListener() {
  if (!db || !gameId) return;

  const gameRef = ref(db, `games/${gameId}`);
  
  onValue(gameRef, (snapshot) => {
    currentGame = snapshot.val();
    if (!currentGame) {
      console.log("Room closed");
      showNotification("Room has been closed");
      resetGameUI();
      return;
    }
    
    // Update room info modal if open
    if (roomInfoModal.style.display === 'flex') {
      updateRoomInfo();
    }
    
    updateGameUI();
    updatePlayersUI();
    updatePlayerPositions();
    
    // Reset timer on any game activity
    resetInactivityTimer();
  });
}

function updateRoomInfo() {
  roomCodeDisplay.textContent = currentGame.roomCode;
  roomStatusDisplay.textContent = currentGame.status === 'waiting' ? 'Waiting for players...' : 'Game in progress';
  updateRoomPlayersList();
  
  if (isHost) {
    const canStart = Object.keys(currentGame.players).length >= 2;
    startGameBtn.disabled = !canStart;
    startGameBtn.textContent = canStart ? "Start Game" : "Need at least 2 players";
  }
}

function updateGameUI() {
  if (!currentGame.gameStarted) {
    statusElement.textContent = `Waiting for host to start... (${Object.keys(currentGame.players).length} players)`;
    rollBtn.disabled = true;
    startBtn.disabled = !isHost;
  } 
  else if (currentGame.currentPlayer === myPlayerId) {
    statusElement.textContent = "Your turn! Roll the dice!";
    rollBtn.disabled = false;
  } 
  else {
    statusElement.textContent = `Waiting for ${currentGame.players[currentGame.currentPlayer]?.name || 'other player'}...`;
    rollBtn.disabled = true;
  }
  
  if (currentGame.diceValue > 0) {
    statusElement.textContent += ` Dice: ${currentGame.diceValue}`;
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
        ${id === myPlayerId ? '(You)' : ''} 
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
      playerEl.title = `${player.name} (Position: ${player.position})`;
      cell.appendChild(playerEl);
    }
  });
}

function resetGameUI() {
  board.innerHTML = '';
  playersElement.innerHTML = '';
  statusElement.textContent = "Select or create a room to play";
  startBtn.disabled = true;
  rollBtn.disabled = true;
  gameId = null;
  currentGame = null;
  isHost = false;
  
  // Show room selection again
  roomModal.style.display = 'flex';
  roomInfoModal.style.display = 'none';
}

// Event Listeners
submitUsername.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    myPlayerName = username;
    usernameModal.style.display = 'none';
    roomModal.style.display = 'flex';
  } else {
    showNotification("Please enter a username!");
  }
});

createRoomBtn.addEventListener('click', async () => {
  await createNewRoom();
  roomModal.style.display = 'none';
});

joinRoomBtn.addEventListener('click', async () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (roomCode.length !== 4) {
    showNotification("Room code must be 4 characters!");
    return;
  }
  
  const success = await joinRoom(roomCode);
  if (success) {
    roomModal.style.display = 'none';
    showRoomInfo(roomCode);
    startInactivityTimer();
  }
});

copyRoomCodeBtn.addEventListener('click', () => {
  const roomCode = roomCodeDisplay.textContent;
  navigator.clipboard.writeText(roomCode);
  showNotification("Room code copied!");
});

startGameBtn.addEventListener('click', async () => {
  if (!isHost) return;
  
  try {
    await update(ref(db, `games/${gameId}`), {
      status: 'playing',
      currentPlayer: myPlayerId,
      gameStarted: true,
      startedAt: Date.now(),
      lastActivity: Date.now()
    };
    
    roomInfoModal.style.display = 'none';
    showNotification("Game started!");
  } catch (error) {
    console.error("Error starting game:", error);
    showNotification("Failed to start game");
  }
});

startBtn.addEventListener('click', async () => {
  if (!isHost || !db) return;

  try {
    await update(ref(db, `games/${gameId}`), {
      currentPlayer: myPlayerId,
      diceValue: 0,
      gameStarted: true,
      startedAt: Date.now(),
      lastActivity: Date.now()
    });
    
    showNotification("Game started!");
  } catch (error) {
    console.error("Error starting game:", error);
    showNotification("Failed to start game");
  }
});

rollBtn.addEventListener('click', async () => {
  if (!db || currentGame?.currentPlayer !== myPlayerId) return;

  const dice = Math.floor(Math.random() * 6) + 1;
  
  try {
    await runTransaction(ref(db, `games/${gameId}`), (game) => {
      if (!game) return null;
      
      const player = game.players[myPlayerId];
      let newPosition = player.position + dice;
      let isWinner = false;
      
      // Check if won
      if (newPosition >= 100) {
        newPosition = 100;
        isWinner = true;
      } 
      // Check snake/ladder
      else if (snakesAndLadders[newPosition]) {
        newPosition = snakesAndLadders[newPosition];
      }
      
      // Update position
      game.players[myPlayerId].position = newPosition;
      game.diceValue = dice;
      game.lastActivity = Date.now();
      
      // Change turn if not won
      if (!isWinner) {
        const playerIds = Object.keys(game.players);
        const currentIdx = playerIds.indexOf(myPlayerId);
        game.currentPlayer = playerIds[(currentIdx + 1) % playerIds.length];
      }
      
      return game;
    });

    // Check if won
    if (currentGame.players[myPlayerId].position >= 100) {
      setTimeout(() => {
        showNotification(`${myPlayerName} wins! Game will reset.`);
        resetGame();
      }, 500);
    }
  } catch (error) {
    console.error("Error rolling dice:", error);
    showNotification("Failed to roll dice");
  }
});

// Initialize the game
initBoard();
usernameModal.style.display = 'flex';
