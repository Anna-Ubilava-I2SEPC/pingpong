import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: { [id: string]: number };
  score: { [id: string]: number };
}

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_HEIGHT = 100;

let gameState: GameState = {
  ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 5, vy: 5 },
  paddles: {},
  score: {},
};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  gameState.paddles[socket.id] = HEIGHT / 2;
  gameState.score[socket.id] = 0;

  socket.on("paddleMove", (y: number) => {
    gameState.paddles[socket.id] = y;
  });

  socket.on("disconnect", () => {
    delete gameState.paddles[socket.id];
    delete gameState.score[socket.id];
    console.log(`User disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  const ball = gameState.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Bounce off top/bottom walls
  if (ball.y <= 0 || ball.y >= HEIGHT) {
    ball.vy *= -1;
  }

  // paddle collision (left & right sides)
  Object.entries(gameState.paddles).forEach(([id, paddleY], index) => {
    const isLeft = index === 0;
    const paddleX = isLeft ? 30 : WIDTH - 40;
    const withinX = isLeft ? ball.x <= paddleX + 10 : ball.x >= paddleX;
    const withinY = ball.y >= paddleY && ball.y <= paddleY + PADDLE_HEIGHT;

    if (withinX && withinY) {
      ball.vx *= -1;
    }
  });

  // Scoring
  // Check if the ball went past left or right edge (score)
  if (ball.x < 0 || ball.x > WIDTH) {
    // Identify which player scored (opposite of the side the ball exited)
    const playerIds = Object.keys(gameState.paddles);
    const scorer = ball.x < 0 ? playerIds[1] : playerIds[0];

    if (scorer) {
      gameState.score[scorer] = (gameState.score[scorer] || 0) + 1;
    }

    // Reset ball and reverse direction
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    ball.vx = ball.vx > 0 ? -5 : 5; // Flip direction to serve to the other player
    ball.vy = (Math.random() - 0.5) * 10; // Add some vertical randomness
  }

  // Emit game state; Send game state to clients
  io.emit("gameState", gameState);
}, 1000 / 60);

server.listen(3001, "0.0.0.0", () => {
  console.log("Server running on port 3001");
});
