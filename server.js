const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

// Server setup
const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data
const availableRooms = [
  'nestjs',
  'nextjs',
  'backend development',
  'frontend development',
  'database design',
  'chess talks',

];
const connectedUser = {};

// Helper functions
const isRoomAvailable = (room) => {
  return availableRooms.includes(room);
};

const availableRoomsData = () => {
  return availableRooms.map((room) => {
    const totalUserCountInRoom = io.of("/").adapter.rooms.get(room)?.size || 0;
    return {
      name: room,
      count: totalUserCountInRoom
    };
  });
};

// Socket.io events
io.on('connection', (socket) => {
  // Emit initial rooms data
  socket.emit('rooms', availableRoomsData());

  // Join room request
  socket.on('join room request', ({ roomId, username }) => {
    const roomAvailable = isRoomAvailable(roomId);
    
    if (roomAvailable) {
      socket.join(roomId);
      const roomCount = io.of("/").adapter.rooms.get(roomId)?.size || 0;
      
      io.emit('rooms', availableRoomsData());
      socket.emit('join room', { hasRoom: true, roomId, roomCount });
      io.to(roomId).emit('joined room', { roomId, username, roomCount });
      socket.except(availableRooms).emit('room log', { roomId, username, status: 'joined' });
    } else {
      socket.emit('join room', { hasRoom: false });
    }
  });

  // Check room availability
  socket.on('room availability', (roomId) => {
    const isAvailable = availableRooms.includes(roomId);
    socket.emit('room availability', isAvailable);
  });

  // Set username
  socket.on('send username', (username) => {
    connectedUser[socket.id] = username;
    
    socket.except(availableRooms).emit('retrieve username', username);
    io.emit('rooms', availableRoomsData());
    io.emit('total online', Object.values(connectedUser).length);
  });

  // Leave room
  socket.on('leave room', (roomId, username) => {
    socket.broadcast.to(roomId).emit('leave room', { username, roomId });
    socket.leave(roomId);
    
    io.emit('rooms', availableRoomsData());
    io.emit('total online', Object.values(connectedUser).length);
    io.except(availableRooms).emit('room log', { roomId, username, status: 'left' });
  });

  //typing message
  socket.on('typing',(username,roomId,textElVal)=>{
    if(!roomId){
      socket.broadcast.except(availableRooms).emit('typing', username,textElVal);
    }
    else{
      socket.broadcast.to(roomId).emit('typing',username,textElVal)
    }
  })

  // Send message
  socket.on('send message', (chatMessage) => {
    if (chatMessage.hasRoom) {
      io.to(chatMessage.roomId).emit('join chat', chatMessage);
    } else {
      io.emit('global chat', chatMessage);
    }
  });

  // New user notification
  socket.broadcast.emit('new user', 'A new user just joined the chat');

  // Disconnect
  socket.on('disconnect', () => {
    const username = connectedUser[socket.id];
    delete connectedUser[socket.id];
    
    if (username) {
      io.emit('user disconnected', username);
      io.emit('total online', Object.values(connectedUser).length);
      io.emit('rooms', availableRoomsData());
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});