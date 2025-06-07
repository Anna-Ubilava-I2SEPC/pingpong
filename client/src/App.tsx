import React, { useEffect, useRef, useState, useCallback } from "react";
import socket from "./socket";
import "./App.css";

const WIDTH = 800;
const HEIGHT = 600;

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: { [id: string]: number };
  score: { [id: string]: number };
  gameStarted: boolean;
  playersReady: { [id: string]: boolean };
  playerCount: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Set player ID when connected
    setPlayerId(socket.id || "");

    socket.on("gameState", (state: GameState) => {
      setGameState(state);
    });

    socket.on("playerCount", (count: number) => {
      setPlayerCount(count);
    });

    socket.on(
      "playerReady",
      ({ playerId, ready }: { playerId: string; ready: boolean }) => {
        console.log(`Player ${playerId} is ${ready ? "ready" : "not ready"}`);
      }
    );

    return () => {
      socket.off("gameState");
      socket.off("playerCount");
      socket.off("playerReady");
    };
  }, []);

  // Keyboard controls
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysPressed.current.add(event.key.toLowerCase());
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressed.current.delete(event.key.toLowerCase());
  }, []);

  // Mouse controls
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!gameState?.gameStarted) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;

      // Convert mouse position to paddle position (accounting for paddle height)
      const paddleY = Math.max(0, Math.min(HEIGHT - 100, mouseY - 50));

      socket.emit("paddlePosition", paddleY);
    },
    [gameState?.gameStarted]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    // Send paddle movement based on keys pressed
    const moveInterval = setInterval(() => {
      if (keysPressed.current.has("arrowup") || keysPressed.current.has("w")) {
        socket.emit("paddleMove", "up");
      }
      if (
        keysPressed.current.has("arrowdown") ||
        keysPressed.current.has("s")
      ) {
        socket.emit("paddleMove", "down");
      }
    }, 1000 / 60); // 60 FPS

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(moveInterval);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !gameState) return;

    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Set canvas style
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";

    // Draw center line
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw ball
    const { ball } = gameState;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw paddles
    const playerIds = Object.keys(gameState.paddles);
    playerIds.forEach((id, index) => {
      const paddleY = gameState.paddles[id];
      const paddleX = index === 0 ? 20 : WIDTH - 30;

      // Highlight current player's paddle
      if (id === socket.id) {
        ctx.fillStyle = "#00ff00"; // Green for current player
      } else {
        ctx.fillStyle = "#ffffff"; // White for opponent
      }

      ctx.fillRect(paddleX, paddleY, 10, 100);
    });

    // Draw game status
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";

    if (!gameState.gameStarted) {
      if (playerCount < 2) {
        ctx.fillText("Waiting for players...", WIDTH / 2, HEIGHT / 2 - 30);
        ctx.fillText(
          `${playerCount}/2 players connected`,
          WIDTH / 2,
          HEIGHT / 2
        );
      } else {
        const readyCount = Object.values(gameState.playersReady).filter(
          (ready) => ready
        ).length;
        ctx.fillText(`${readyCount}/2 players ready`, WIDTH / 2, HEIGHT / 2);
      }
    }
  }, [gameState, playerCount]);

  const handleStartGame = () => {
    socket.emit("startGame");
    setIsReady(true);
  };

  const getScoreArray = () => {
    if (!gameState) return [];
    return Object.entries(gameState.score).map(([id, score], index) => ({
      id,
      score,
      isCurrentPlayer: id === socket.id,
      playerNumber: index + 1,
    }));
  };

  return (
    <div className="App">
      <div className="game-container">
        <h1>Multiplayer Ping-Pong</h1>

        <div className="game-info">
          <p>Players Connected: {playerCount}/2</p>
          {gameState && gameState.gameStarted && (
            <p>
              Game Status: <span className="status-playing">Playing</span>
            </p>
          )}
          {gameState && !gameState.gameStarted && playerCount >= 2 && (
            <p>
              Game Status:{" "}
              <span className="status-waiting">
                Waiting for players to start
              </span>
            </p>
          )}
          {playerCount < 2 && (
            <p>
              Game Status:{" "}
              <span className="status-waiting">Waiting for players</span>
            </p>
          )}
        </div>

        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="game-canvas"
        />

        <div className="controls">
          <div className="control-instructions">
            <p>
              <strong>Controls:</strong>
            </p>
            <p>
              🎹 <strong>Keyboard:</strong> Use Arrow Keys or W/S to move your
              paddle
            </p>
            <p>
              🖱️ <strong>Mouse:</strong> Move mouse up/down to control your
              paddle
            </p>
            <p>
              Your paddle is highlighted in{" "}
              <span style={{ color: "#00ff00" }}>green</span>
            </p>
          </div>

          {playerCount >= 2 && !gameState?.gameStarted && !isReady && (
            <button onClick={handleStartGame} className="start-button">
              Start Playing
            </button>
          )}

          {isReady && !gameState?.gameStarted && (
            <p className="waiting-message">
              Waiting for other player to start...
            </p>
          )}
        </div>

        {gameState && Object.keys(gameState.score).length > 0 && (
          <div className="scoreboard">
            <h2>Score</h2>
            <div className="scores">
              {getScoreArray().map((player) => (
                <div
                  key={player.id}
                  className={`player-score ${
                    player.isCurrentPlayer ? "current-player" : ""
                  }`}
                >
                  <span className="player-name">
                    {player.isCurrentPlayer
                      ? "You"
                      : `Player ${player.playerNumber}`}
                  </span>
                  <span className="score">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
