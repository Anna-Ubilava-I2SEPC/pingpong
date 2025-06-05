import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  // events will be handeled here
});

server.listen(3001, () => console.log("Server running on port 3001"));
