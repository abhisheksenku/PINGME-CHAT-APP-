// ================== 1. IMPORTS ==================
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Custom imports
const userAuthenticate = require('./middleware/auth');
const database = require("./utilities/sql");
const models = require("./models/associations");

// Route imports
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const contactRoutes = require("./routes/contactRoutes");
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');

// Socket.io import
const { initializeSocket } = require("./socket/index");

// ================== 2. INITIALIZATION ==================
const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io

// ================== 3. SOCKET.IO INITIALIZATION ==================
const io = initializeSocket(server);
app.set("socketio", io); // Make io accessible in routes

const port = process.env.PORT || 3000;

// ================== 4. EXPRESS MIDDLEWARE ==================
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ================== 5. EXPRESS ROUTES ==================
app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/group", groupRoutes);
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// ================== 6. PAGE ROUTES ==================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "page.html"));
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "forgotPassword.html"));
});

app.get('/reset-password/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/chat", userAuthenticate.authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "chat.html"));
});

// ================== 7. SERVER STARTUP ==================
(async () => {
    try {
        await database.sync({ alter: false });
        
        // Use server.listen() instead of app.listen() for Socket.io
        server.listen(port, () => {
            console.log(`🔌 Server with WebSocket support running on port ${port}`);
        });
    } catch (error) {
        console.error("Unable to connect to the database:", error);
    }
})();