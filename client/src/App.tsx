import "./App.css";

import React, { useEffect } from "react";
import socket from "./socket";

function App() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
    });
  }, []);

  return <div>Pong Game</div>;
}

export default App;
