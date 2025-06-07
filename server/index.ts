import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://16.171.2.199:3000"],
    methods: ["GET", "POST"],
  },
});

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: { [id: string]: number };
  score: { [id: string]: number };
  gameStarted: boolean;
  playersReady: { [id: string]: boolean };
  playerCount: number;
  gameEnded: boolean;
  winner?: string;
}

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_HEIGHT = 100;
const PADDLE_SPEED = 8;
const WINNING_SCORE = 11;

let gameState: GameState = {
  ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 },
  paddles: {},
  score: {},
  gameStarted: false,
  playersReady: {},
  playerCount: 0,
  gameEnded: false,
};

let gameInterval: NodeJS.Timeout | null = null;
let ballResetInProgress = false; // Flag to prevent multiple scoring

function resetBall() {
  gameState.ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: Math.random() > 0.5 ? 5 : -5,
    vy: (Math.random() - 0.5) * 6,
  };
  ballResetInProgress = false;
}

function checkWinner() {
  const playerIds = Object.keys(gameState.score);
  for (const playerId of playerIds) {
    if (gameState.score[playerId] >= WINNING_SCORE) {
      gameState.gameEnded = true;
      gameState.gameStarted = false;
      gameState.winner = playerId;

      if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
      }

      io.emit("gameWon", { winner: playerId, finalScore: gameState.score });
      return true;
    }
  }
  return false;
}

function startGame() {
  if (gameInterval) clearInterval(gameInterval);

  // Reset game state
  gameState.gameEnded = false;
  gameState.winner = undefined;
  ballResetInProgress = false;

  // Reset scores
  Object.keys(gameState.score).forEach((id) => {
    gameState.score[id] = 0;
  });

  resetBall();
  gameState.gameStarted = true;

  gameInterval = setInterval(() => {
    if (!gameState.gameStarted || gameState.gameEnded) return;

    const ball = gameState.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off top/bottom walls
    if (ball.y <= 10 || ball.y >= HEIGHT - 10) {
      ball.vy *= -1;
    }

    // Paddle collision detection
    const playerIds = Object.keys(gameState.paddles);
    playerIds.forEach((id, index) => {
      const paddleY = gameState.paddles[id];
      const isLeft = index === 0;
      const paddleX = isLeft ? 20 : WIDTH - 30;

      // Check collision
      if (
        ((isLeft && ball.x - 10 <= paddleX + 10 && ball.x > paddleX) ||
          (!isLeft && ball.x + 10 >= paddleX && ball.x < paddleX + 10)) &&
        ball.y >= paddleY - 10 &&
        ball.y <= paddleY + PADDLE_HEIGHT + 10
      ) {
        ball.vx *= -1;
        // Add some spin based on where the ball hits the paddle
        const hitPos = (ball.y - paddleY) / PADDLE_HEIGHT;
        ball.vy = (hitPos - 0.5) * 8;
      }
    });

    // Scoring - ball goes off screen (only if not already in reset process)
    if ((ball.x < -10 || ball.x > WIDTH + 10) && !ballResetInProgress) {
      ballResetInProgress = true; // Prevent multiple scoring

      const playerIds = Object.keys(gameState.paddles);
      const scorer = ball.x < -10 ? playerIds[1] : playerIds[0];

      if (scorer && gameState.score[scorer] !== undefined) {
        gameState.score[scorer]++;
        console.log(
          `Player ${scorer} scored! New score: ${gameState.score[scorer]}`
        );

        // Check for winner before resetting ball
        if (checkWinner()) {
          return; // Game ended, don't reset ball
        }
      }

      // Reset ball position after delay
      setTimeout(() => {
        if (!gameState.gameEnded) {
          resetBall();
        }
      }, 1000);
    }

    // Emit game state to all clients
    io.emit("gameState", gameState);
  }, 1000 / 60); // 60 FPS
}

function stopGame() {
  gameState.gameStarted = false;
  gameState.gameEnded = false;
  gameState.winner = undefined;
  gameState.ball.vx = 0;
  gameState.ball.vy = 0;
  gameState.ball.x = WIDTH / 2;
  gameState.ball.y = HEIGHT / 2;
  ballResetInProgress = false;

  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
}

function checkGameStart() {
  const playerIds = Object.keys(gameState.playersReady);
  const readyCount = Object.values(gameState.playersReady).filter(
    (ready) => ready
  ).length;

  if (
    playerIds.length >= 2 &&
    readyCount >= 2 &&
    !gameState.gameStarted &&
    !gameState.gameEnded
  ) {
    startGame();
  }
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize player
  gameState.paddles[socket.id] = HEIGHT / 2 - PADDLE_HEIGHT / 2;
  gameState.score[socket.id] = 0;
  gameState.playersReady[socket.id] = false;
  gameState.playerCount++;

  // Send initial game state
  socket.emit("gameState", gameState);
  io.emit("playerCount", gameState.playerCount);

  socket.on("paddleMove", (direction: "up" | "down") => {
    if (!gameState.gameStarted) return;

    const currentY = gameState.paddles[socket.id];
    let newY = currentY;

    if (direction === "up") {
      newY = Math.max(0, currentY - PADDLE_SPEED);
    } else if (direction === "down") {
      newY = Math.min(HEIGHT - PADDLE_HEIGHT, currentY + PADDLE_SPEED);
    }

    gameState.paddles[socket.id] = newY;
  });

  socket.on("paddlePosition", (y: number) => {
    if (!gameState.gameStarted) return;

    // Ensure the position is within bounds
    const boundedY = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, y));
    gameState.paddles[socket.id] = boundedY;
  });

  socket.on("startGame", () => {
    console.log(`Player ${socket.id} is ready to start`);
    gameState.playersReady[socket.id] = true;

    io.emit("playerReady", { playerId: socket.id, ready: true });
    checkGameStart();
  });

  socket.on("playAgain", () => {
    console.log(`Player ${socket.id} wants to play again`);
    gameState.playersReady[socket.id] = true;

    // Reset game end state
    if (gameState.gameEnded) {
      gameState.gameEnded = false;
      gameState.winner = undefined;
    }

    io.emit("playerReady", { playerId: socket.id, ready: true });
    checkGameStart();
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    delete gameState.paddles[socket.id];
    delete gameState.score[socket.id];
    delete gameState.playersReady[socket.id];
    gameState.playerCount--;

    // Stop game if less than 2 players
    if (gameState.playerCount < 2) {
      stopGame();
      // Reset ready states for remaining players
      Object.keys(gameState.playersReady).forEach((id) => {
        gameState.playersReady[id] = false;
      });
    }

    io.emit("playerCount", gameState.playerCount);
    io.emit("gameState", gameState);
  });
});

// Send game state regularly even when game is not started (for paddle positions)
setInterval(() => {
  io.emit("gameState", gameState);
}, 1000 / 30); // 30 FPS for non-game updates

server.listen(3001, "0.0.0.0", () =>
  console.log("Server running on port 3001")
);
