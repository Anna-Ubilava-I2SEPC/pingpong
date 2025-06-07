import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins - restrict in production
  },
});

// Game state interface definition
interface GameState {
  ball: { x: number; y: number; vx: number; vy: number }; // Ball position and velocity
  paddles: { [id: string]: number }; // Player ID mapped to paddle Y position
  score: { [id: string]: number }; // Player ID mapped to current score
  gameStarted: boolean; // Whether game is currently active
  playersReady: { [id: string]: boolean }; // Ready state for each player
  playerCount: number; // Number of connected players
  gameEnded: boolean; // Whether game has ended
  winner?: string; // ID of winning player (if game ended)
}

// Game configuration constants
const WIDTH = 800; // Canvas width
const HEIGHT = 600; // Canvas height
const PADDLE_HEIGHT = 100; // Height of player paddles
const PADDLE_SPEED = 8; // Pixels per frame paddle movement speed
const WINNING_SCORE = 11; // Score needed to win the game

// Initialize game state with default values
let gameState: GameState = {
  ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 },
  paddles: {},
  score: {},
  gameStarted: false,
  playersReady: {},
  playerCount: 0,
  gameEnded: false,
};

// Game loop interval reference for cleanup
let gameInterval: NodeJS.Timeout | null = null;

// Flag to prevent multiple scoring events from single ball exit
let ballResetInProgress = false;

/**
 * Reset ball to center with random initial velocity
 * Called at game start and after each point scored
 */
function resetBall() {
  gameState.ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    // Random horizontal direction, moderate vertical velocity
    vx: Math.random() > 0.5 ? 5 : -5,
    vy: (Math.random() - 0.5) * 6,
  };
  ballResetInProgress = false;
}

/**
 * Check if any player has reached the winning score
 * If so, end the game and notify all clients
 * @returns true if game ended, false if game continues
 */
function checkWinner() {
  const playerIds = Object.keys(gameState.score);

  for (const playerId of playerIds) {
    if (gameState.score[playerId] >= WINNING_SCORE) {
      // Set game end state
      gameState.gameEnded = true;
      gameState.gameStarted = false;
      gameState.winner = playerId;

      // Stop the game loop
      if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
      }

      // Notify all clients of game end
      io.emit("gameWon", { winner: playerId, finalScore: gameState.score });
      return true;
    }
  }
  return false;
}

/**
 * Initialize and start the game loop
 * Resets scores, ball position, and begins physics simulation
 */
function startGame() {
  // Clear any existing game loop
  if (gameInterval) clearInterval(gameInterval);

  // Reset game state for new game
  gameState.gameEnded = false;
  gameState.winner = undefined;
  ballResetInProgress = false;

  // Reset all player scores to 0
  Object.keys(gameState.score).forEach((id) => {
    gameState.score[id] = 0;
  });

  // Initialize ball and start game
  resetBall();
  gameState.gameStarted = true;

  // Main game loop
  gameInterval = setInterval(() => {
    // Skip physics if game is not active
    if (!gameState.gameStarted || gameState.gameEnded) return;

    const ball = gameState.ball;

    // Update ball position based on velocity
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Ball collision with top/bottom walls
    if (ball.y <= 10 || ball.y >= HEIGHT - 10) {
      ball.vy *= -1; // Reverse vertical velocity
    }

    // Paddle collision detection and response
    const playerIds = Object.keys(gameState.paddles);
    playerIds.forEach((id, index) => {
      const paddleY = gameState.paddles[id];
      const isLeft = index === 0; // First player is on left side
      const paddleX = isLeft ? 20 : WIDTH - 30;

      // Check if ball is colliding with this paddle
      if (
        ((isLeft && ball.x - 10 <= paddleX + 10 && ball.x > paddleX) ||
          (!isLeft && ball.x + 10 >= paddleX && ball.x < paddleX + 10)) &&
        ball.y >= paddleY - 10 &&
        ball.y <= paddleY + PADDLE_HEIGHT + 10
      ) {
        // Reverse horizontal velocity (bounce off paddle)
        ball.vx *= -1;

        // Add spin based on where ball hits paddle
        // Hit near top = upward spin, hit near bottom = downward spin
        const hitPos = (ball.y - paddleY) / PADDLE_HEIGHT;
        ball.vy = (hitPos - 0.5) * 8;
      }
    });

    // Scoring logic - ball goes off left or right edge
    if ((ball.x < -10 || ball.x > WIDTH + 10) && !ballResetInProgress) {
      ballResetInProgress = true; // Prevent multiple scoring

      const playerIds = Object.keys(gameState.paddles);
      // Determine who scored based on which side ball exited
      const scorer = ball.x < -10 ? playerIds[1] : playerIds[0];

      if (scorer && gameState.score[scorer] !== undefined) {
        gameState.score[scorer]++;
        console.log(
          `Player ${scorer} scored! New score: ${gameState.score[scorer]}`
        );

        // Check if this score wins the game
        if (checkWinner()) {
          return; // Game ended, don't reset ball
        }
      }

      // Reset ball position after short delay
      setTimeout(() => {
        if (!gameState.gameEnded) {
          resetBall();
        }
      }, 1000);
    }

    // Broadcast updated game state to all clients
    io.emit("gameState", gameState);
  }, 1000 / 60); // 60 FPS game loop
}

/**
 * Stop the current game and reset state
 * Used when players disconnect or game needs to be reset
 */
function stopGame() {
  gameState.gameStarted = false;
  gameState.gameEnded = false;
  gameState.winner = undefined;

  // Stop ball movement
  gameState.ball.vx = 0;
  gameState.ball.vy = 0;
  gameState.ball.x = WIDTH / 2;
  gameState.ball.y = HEIGHT / 2;
  ballResetInProgress = false;

  // Clear game loop
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
}

/**
 * Check if conditions are met to start the game
 * Requires 2+ players with both ready
 */
function checkGameStart() {
  const playerIds = Object.keys(gameState.playersReady);
  const readyCount = Object.values(gameState.playersReady).filter(
    (ready) => ready
  ).length;

  // Start game if we have 2+ players, all are ready, and game isn't already running
  if (
    playerIds.length >= 2 &&
    readyCount >= 2 &&
    !gameState.gameStarted &&
    !gameState.gameEnded
  ) {
    startGame();
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize new player state
  gameState.paddles[socket.id] = HEIGHT / 2 - PADDLE_HEIGHT / 2; // Center paddle
  gameState.score[socket.id] = 0;
  gameState.playersReady[socket.id] = false;
  gameState.playerCount++;

  // Send current game state to newly connected player
  socket.emit("gameState", gameState);

  // Broadcast updated player count to all clients
  io.emit("playerCount", gameState.playerCount);

  /**
   * Handle paddle movement via keyboard input
   * @param direction - "up" or "down" movement command
   */
  socket.on("paddleMove", (direction: "up" | "down") => {
    // Only allow movement during active gameplay
    if (!gameState.gameStarted) return;

    const currentY = gameState.paddles[socket.id];
    let newY = currentY;

    if (direction === "up") {
      // Move up, but don't go above canvas top
      newY = Math.max(0, currentY - PADDLE_SPEED);
    } else if (direction === "down") {
      // Move down, but don't go below canvas bottom
      newY = Math.min(HEIGHT - PADDLE_HEIGHT, currentY + PADDLE_SPEED);
    }

    gameState.paddles[socket.id] = newY;
  });

  /**
   * Handle paddle positioning via mouse input
   * @param y - Desired paddle Y position
   */
  socket.on("paddlePosition", (y: number) => {
    // Only allow movement during active gameplay
    if (!gameState.gameStarted) return;

    // Ensure the position is within canvas bounds
    const boundedY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, y));
    gameState.paddles[socket.id] = boundedY;
  });

  /**
   * Handle player ready state for game start
   */
  socket.on("startGame", () => {
    console.log(`Player ${socket.id} is ready to start`);
    gameState.playersReady[socket.id] = true;

    // Notify all clients of ready state change
    io.emit("playerReady", { playerId: socket.id, ready: true });

    // Check if we can start the game now
    checkGameStart();
  });

  /**
   * Handle play again request after game ends
   */
  socket.on("playAgain", () => {
    console.log(`Player ${socket.id} wants to play again`);
    gameState.playersReady[socket.id] = true;

    // Reset game end state if needed
    if (gameState.gameEnded) {
      gameState.gameEnded = false;
      gameState.winner = undefined;
    }

    // Notify all clients of ready state change
    io.emit("playerReady", { playerId: socket.id, ready: true });

    // Check if we can start a new game
    checkGameStart();
  });

  /**
   * Handle player disconnection
   * Clean up player data and stop game if not enough players
   */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove player from game state
    delete gameState.paddles[socket.id];
    delete gameState.score[socket.id];
    delete gameState.playersReady[socket.id];
    gameState.playerCount--;

    // Stop game if less than 2 players remain
    if (gameState.playerCount < 2) {
      stopGame();

      // Reset ready states for remaining players
      Object.keys(gameState.playersReady).forEach((id) => {
        gameState.playersReady[id] = false;
      });
    }

    // Broadcast updated state to remaining clients
    io.emit("playerCount", gameState.playerCount);
    io.emit("gameState", gameState);
  });
});

// Send game state updates regularly, even when game is paused
// This ensures paddle positions are synchronized for lobby/waiting states
setInterval(() => {
  io.emit("gameState", gameState);
}, 1000 / 30); // 30 FPS for non-gameplay updates

// Start the server
server.listen(3001, () => console.log("Server running on port 3001"));
