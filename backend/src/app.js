require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const topicRoutes = require('./routes/topics');
const matchRoutes = require('./routes/matches');
const debateRoutes = require('./routes/debate');
const adminRoutes = require('./routes/admin');

const setupDebateSockets = require('./sockets/debateSocket');

const app = express();
const httpServer = createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupDebateSockets(io);
app.set('io', io); // share io instance with route handlers

// ── Connect DB ────────────────────────────────────────────────────────────────
connectDB();

// ── Global Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/debate', debateRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'AgentSlam API is running', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = { app, httpServer };
