const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const path = require('path');
const compileWithJDoodle = require('./compilerAPI'); // JDoodle compile logic
const generateAST = require('./generateAST');        // AST Generator using Tree-sitter
require('dotenv').config();                          // Load .env

// 🔧 Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 🚀 JDoodle Code Compile Endpoint
app.post('/compile', async (req, res) => {
  const { code, language, versionIndex, stdin } = req.body;

  if (!code || !language) {
    return res.status(400).send("Missing 'code' or 'language'");
  }

  try {
    const output = await compileWithJDoodle(code, language, versionIndex || "0", stdin || "");
    res.json({ output });
  } catch (err) {
    console.error("❌ Compilation Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// 🌳 AST Generation Endpoint
app.post('/generate-ast', async (req, res) => {
  const { code, language } = req.body;

  console.log("🔍 AST Request Received:");
  console.log("🌐 Language:", language);
  console.log("📝 Code snippet:", code.slice(0, 100)); // Log first 100 chars

  if (!code || !language) {
    return res.status(400).send("Missing 'code' or 'language'");
  }

  try {
    const ast = await generateAST(code, language); // Uses Tree-sitter
    console.log("✅ AST generated successfully");
    res.json(ast);
  } catch (err) {
    console.error("❌ AST Generation Error:", err);
    res.status(500).json({ error: 'Failed to generate AST' });
  }
});

// 🌐 Real-time Collaboration with Socket.IO
io.on('connection', (socket) => {
  console.log('🟢 New user connected');

  socket.on('join', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;
    console.log(`👤 ${username} joined room: ${roomId}`);
    updateClientsList(roomId);
  });

  socket.on('code-change', ({ roomId, code }) => {
    socket.to(roomId).emit('code-change', { code });
  });

  socket.on('chat-message', ({ roomId, username, message }) => {
    io.to(roomId).emit('chat-message', { username, message });
  });

  socket.on('presence', ({ roomId, username, position }) => {
    socket.to(roomId).emit('presence', { username, position });
  });

  socket.on('leave', ({ roomId, username }) => {
    socket.leave(roomId);
    console.log(`🚪 ${username} left room: ${roomId}`);
    updateClientsList(roomId);
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      console.log(`🔌 ${socket.username} disconnected from room: ${socket.roomId}`);
      socket.leave(socket.roomId);
      updateClientsList(socket.roomId);
    }
  });

  function updateClientsList(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    const clients = room
      ? Array.from(room).map(id => io.sockets.sockets.get(id)?.username || 'Unknown')
      : [];

    io.to(roomId).emit('joined', { clients });
    io.to(roomId).emit('disconnected', { clients });
  }
});

// ✅ Start Server
const PORT = 8000;
http.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
