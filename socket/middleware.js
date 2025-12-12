// socket/middleware.js
const jwt = require("jsonwebtoken");

/**
 * Attaches authentication middleware to the Socket.IO server.
 * This runs *before* the 'connection' event.
 * It verifies the JWT from `socket.handshake.auth.token`
 * and attaches `socket.userId` for use in all other handlers.
 * @param {Server} io - The Socket.IO server instance.
 */
function socketAuth(io) {
  io.use((socket, next) => {
    try {
      // 1. Get the token from the client
      const token = socket.handshake.auth?.token;
      if (!token) {
        // We use 'auth_error' for the client to listen to
        console.error("Socket Auth: No token provided.");
        return next(new Error("Authentication error"));
      }

      // 2. Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 3. Attach the user's ID to the socket object
      // This makes it available as 'socket.userId' everywhere
      const userId = decoded.user?.id ?? decoded.userId ?? null;

      if (!userId) {
        console.error("Socket Auth: Token is valid but has no user ID.");
        return next(new Error("Authentication error"));
      }
      
      socket.userId = userId;
      
      // 4. All good, allow the connection
      next();
      
    } catch (err) {
      // Token is invalid, expired, or malformed
      console.error("Socket Auth: Invalid token.", err.message);
      return next(new Error("Authentication error"));
    }
  });
}

module.exports = socketAuth;