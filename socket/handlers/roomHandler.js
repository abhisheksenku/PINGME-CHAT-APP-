// socket/handlers/roomHandler.js
module.exports = (socket, io) => {
  const userId = socket.userId;

  socket.on("joinGroup", (payload) => {
    const { groupId } = payload;
    if (!groupId) return;
    
    // FIX: Use underscore to match messageHandler
    const roomName = `group_${groupId}`;
    socket.join(roomName);
    console.log(`User ${userId} joined room: ${roomName}`);
  });

  socket.on("leaveGroup", (payload) => {
    const { groupId } = payload;
    if (!groupId) return;
    
    // FIX: Use underscore to match messageHandler
    const roomName = `group_${groupId}`;
    socket.leave(roomName);
    console.log(`User ${userId} left room: ${roomName}`);
  });
};