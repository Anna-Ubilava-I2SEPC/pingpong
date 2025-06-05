import React, { useEffect, useRef, useState } from "react";
import socket from "./socket";
import "./App.css";

const WIDTH = 800;
const HEIGHT = 600;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paddleY, setPaddleY] = useState(HEIGHT / 2);
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    socket.on("gameState", (state) => setGameState(state));

    const handleMouseMove = (e: MouseEvent) => {
      const y = e.clientY - 50;
      setPaddleY(y);
      socket.emit("paddleMove", y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !gameState) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw ball
    const { ball, paddles } = gameState;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw paddles
    Object.values(paddles).forEach((y, i) => {
      const yPos = y as number;
      ctx.fillRect(i === 0 ? 20 : WIDTH - 30, yPos, 10, 100);
    });
  }, [gameState]);

  return (
    <div className="App">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
    </div>
  );
}

export default App;
