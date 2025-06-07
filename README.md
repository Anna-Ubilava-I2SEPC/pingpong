# 🏓 Multiplayer Ping-Pong Game

A real-time multiplayer ping-pong game built with React, Node.js, Socket.IO, and TypeScript.

## ✨ Features

- **Real-time Multiplayer**: Play against other players in real-time using WebSocket connections
- **Dual Control System**: Control your paddle using either keyboard (Arrow Keys/WASD) or mouse movement
- **Visual Feedback**: Your paddle is highlighted in green to distinguish it from your opponent's
- **Live Scoring**: Real-time score tracking with win detection (first to 11 points wins)
- **Game State Management**: Proper lobby system with ready states and game restart functionality

## 🚀 Quick Start

### Prerequisites

- Node.js
- npm

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Anna-Ubilava-I2SEPC/pingpong.git
   cd pingpong
   ```

2. **Install server dependencies**

   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**

   ```bash
   cd ../client
   npm install
   ```

4. **Start the server**

   ```bash
   cd ../server
   npm run dev
   ```

   Server will start on `http://localhost:3001`

5. **Start the client (in a new terminal)**

   ```bash
   cd client
   npm run dev
   ```

   Client will start on `http://localhost:5173`

6. **Play the game**
   - Open `http://localhost:5173` in two different browser windows/tabs
   - Both players click "Start Playing" when ready
   - Use Arrow Keys, WASD, or mouse to control your paddle
   - First to 11 points wins!

## 🎮 How to Play

### Controls

- **Keyboard**: Use `↑/↓ Arrow Keys` or `W/S` keys to move your paddle up and down
- **Mouse**: Move your mouse up and down to control your paddle position

### Game Rules

- First player to reach 11 points wins the game
- Ball bounces off top and bottom walls
- Ball bounces off paddles with spin based on where it hits
- Score increases when the ball goes past the opponent's paddle

### Game Flow

1. Wait for 2 players to connect
2. Both players must click "Start Playing" to begin
3. Play until one player reaches 11 points
4. Winner is announced, and players can choose to "Play Again"

---
