import { io } from "socket.io-client";

/**
 * Socket.IO client configuration
 *
 * Creates a connection to the game server running on localhost:3001
 * This socket instance is used throughout the client application for:
 * - Sending player input (paddle movement, ready states)
 * - Receiving game state updates
 * - Handling connection/disconnection events
 *
 * Note: for production, "http://localhost:3001" will be replaced with myr actual server URL
 */
const socket = io("http://localhost:3001");
export default socket;
