import React, { useEffect, useRef, useState, useCallback } from "react";
import socket from "./socket";
import "./App.css";

// Game canvas dimensions - matches server configuration
const WIDTH = 800;
const HEIGHT = 600;

// Interface definitions for type safety
interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: { [id: string]: number }; // Player ID mapped to paddle Y position
  score: { [id: string]: number }; // Player ID mapped to score
  gameStarted: boolean;
  playersReady: { [id: string]: boolean }; // Ready state for each player
  playerCount: number;
  gameEnded?: boolean;
  winner?: string;
}

interface GameWonData {
  winner: string;
  finalScore: { [id: string]: number };
}

function App() {
  // Canvas reference for direct drawing operations
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state management
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  const [gameWinner, setGameWinner] = useState<GameWonData | null>(null);

  // Track pressed keys for smooth keyboard input
  const keysPressed = useRef<Set<string>>(new Set());

  // Socket event listeners setup
  useEffect(() => {
    // Store player ID when socket connects
    setPlayerId(socket.id || "");

    // Listen for game state updates from server
    socket.on("gameState", (state: GameState) => {
      setGameState(state);
    });

    // Track number of connected players
    socket.on("playerCount", (count: number) => {
      setPlayerCount(count);
    });

    // Handle player ready state changes
    socket.on(
      "playerReady",
      ({ playerId, ready }: { playerId: string; ready: boolean }) => {
        console.log(`Player ${playerId} is ${ready ? "ready" : "not ready"}`);
      }
    );

    // Handle game end event
    socket.on("gameWon", (data: GameWonData) => {
      console.log("Game won!", data);
      setGameWinner(data);
      setIsReady(false); // Reset ready state for potential replay
    });

    // Cleanup event listeners on component unmount
    return () => {
      socket.off("gameState");
      socket.off("playerCount");
      socket.off("playerReady");
      socket.off("gameWon");
    };
  }, []);

  // Keyboard input handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysPressed.current.add(event.key.toLowerCase());
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressed.current.delete(event.key.toLowerCase());
  }, []);

  // Mouse movement handler for paddle control
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      // Only handle mouse input during active gameplay
      if (!gameState?.gameStarted) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Calculate mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;

      // Convert mouse position to paddle position (accounting for paddle height)
      // Clamp paddle position within canvas bounds
      const paddleY = Math.max(0, Math.min(HEIGHT - 100, mouseY - 50));

      // Send paddle position to server
      socket.emit("paddlePosition", paddleY);
    },
    [gameState?.gameStarted]
  );

  // Setup input event listeners and keyboard movement interval
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    // Send paddle movement commands based on pressed keys
    // Runs at 60 FPS for smooth movement
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

    // Cleanup event listeners and interval
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(moveInterval);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove]);

  // Canvas rendering logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !gameState) return;

    // Clear canvas for fresh frame
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Set drawing colors
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";

    // Draw center line (dashed)
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw ball
    const { ball } = gameState;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw paddles for all players
    const playerIds = Object.keys(gameState.paddles);
    playerIds.forEach((id, index) => {
      const paddleY = gameState.paddles[id];
      // Left paddle for first player, right paddle for second player
      const paddleX = index === 0 ? 20 : WIDTH - 30;

      // Highlight current player's paddle in green
      if (id === socket.id) {
        ctx.fillStyle = "#00ff00"; // Green for current player
      } else {
        ctx.fillStyle = "#ffffff"; // White for opponent
      }

      // Draw paddle rectangle
      ctx.fillRect(paddleX, paddleY, 10, 100);
    });

    // Draw game status text
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";

    // Show winner message if game ended
    if (gameWinner) {
      ctx.fillStyle = "#FFD700"; // Gold color for winner
      ctx.font = "32px Arial";
      const isWinner = gameWinner.winner === socket.id;
      const winnerText = isWinner ? "🎉 YOU WON! 🎉" : "💔 YOU LOST 💔";
      ctx.fillText(winnerText, WIDTH / 2, HEIGHT / 2 - 50);

      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.fillText(
        "Click 'Play Again' to start a new game",
        WIDTH / 2,
        HEIGHT / 2 + 20
      );
    } else if (!gameState.gameStarted) {
      // Show waiting messages when game hasn't started
      if (playerCount < 2) {
        ctx.fillText("Waiting for players...", WIDTH / 2, HEIGHT / 2 - 30);
        ctx.fillText(
          `${playerCount}/2 players connected`,
          WIDTH / 2,
          HEIGHT / 2
        );
      } else {
        // Show ready count when enough players are connected
        const readyCount = Object.values(gameState.playersReady).filter(
          (ready) => ready
        ).length;
        ctx.fillText(`${readyCount}/2 players ready`, WIDTH / 2, HEIGHT / 2);
      }
    }
  }, [gameState, playerCount, gameWinner]);

  // Handle start game button click
  const handleStartGame = () => {
    socket.emit("startGame");
    setIsReady(true);
  };

  // Handle play again button click
  const handlePlayAgain = () => {
    socket.emit("playAgain");
    setIsReady(true);
    setGameWinner(null); // Clear the winner state
  };

  // Helper function to format score data for display
  const getScoreArray = () => {
    if (!gameState) return [];
    return Object.entries(gameState.score).map(([id, score], index) => ({
      id,
      score,
      isCurrentPlayer: id === socket.id,
      playerNumber: index + 1,
    }));
  };

  // Helper function to get winner display name
  const getWinnerName = () => {
    if (!gameWinner) return "";
    return gameWinner.winner === socket.id ? "You" : "Your Opponent";
  };

  return (
    <div className="App">
      <div className="game-container">
        <h1>Multiplayer Ping-Pong</h1>

        {/* Game status information */}
        <div className="game-info">
          <p>Players Connected: {playerCount}/2</p>
          {gameWinner && (
            <p>
              Game Status:{" "}
              <span className="status-ended">
                Game Ended - {getWinnerName()} Won!
              </span>
            </p>
          )}
          {gameState && gameState.gameStarted && !gameWinner && (
            <p>
              Game Status: <span className="status-playing">Playing</span>
            </p>
          )}
          {gameState &&
            !gameState.gameStarted &&
            playerCount >= 2 &&
            !gameWinner && (
              <p>
                Game Status:{" "}
                <span className="status-waiting">
                  Waiting for players to start
                </span>
              </p>
            )}
          {playerCount < 2 && !gameWinner && (
            <p>
              Game Status:{" "}
              <span className="status-waiting">Waiting for players</span>
            </p>
          )}
        </div>

        {/* Game canvas - where the actual game is rendered */}
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="game-canvas"
        />

        {/* Game controls and instructions */}
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

          {/* Conditional button rendering based on game state */}
          {/* Show Play Again button if game ended */}
          {gameWinner && (
            <button onClick={handlePlayAgain} className="play-again-button">
              Play Again
            </button>
          )}

          {/* Show Start button if no game ended and conditions are met */}
          {!gameWinner &&
            playerCount >= 2 &&
            !gameState?.gameStarted &&
            !isReady && (
              <button onClick={handleStartGame} className="start-button">
                Start Playing
              </button>
            )}

          {/* Show waiting message when player is ready but game hasn't started */}
          {!gameWinner && isReady && !gameState?.gameStarted && (
            <p className="waiting-message">
              Waiting for other player to start...
            </p>
          )}
        </div>

        {/* Scoreboard - only show when there are scores to display */}
        {gameState && Object.keys(gameState.score).length > 0 && (
          <div className="scoreboard">
            <h2>Score</h2>
            <div className="scores">
              {getScoreArray().map((player) => (
                <div
                  key={player.id}
                  className={`player-score ${
                    player.isCurrentPlayer ? "current-player" : ""
                  } ${
                    gameWinner && gameWinner.winner === player.id
                      ? "winner"
                      : ""
                  }`}
                >
                  <span className="player-name">
                    {player.isCurrentPlayer
                      ? "You"
                      : `Player ${player.playerNumber}`}
                    {/* Add crown emoji for winner */}
                    {gameWinner && gameWinner.winner === player.id && " 👑"}
                  </span>
                  <span className="score">{player.score}</span>
                </div>
              ))}
            </div>
            {/* Show final score when game ends */}
            {gameWinner && (
              <div className="final-score-message">
                <p>
                  Final Score:{" "}
                  {Object.values(gameWinner.finalScore).join(" - ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
