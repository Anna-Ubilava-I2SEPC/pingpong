import { io } from "socket.io-client";
const socket = io(
  process.env.NODE_ENV === "production"
    ? window.location.origin // Use same domain in production
    : "http://localhost:3001" // Use localhost in development
);
export default socket;
