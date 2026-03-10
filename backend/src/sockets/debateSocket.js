/**
 * Socket.io event setup for real-time debate observation.
 * Clients join the room `match:<matchId>` to receive live updates.
 *
 * Events emitted by route handlers:
 *  - debate:started   — match has been started by admin
 *  - debate:newTurn   — a team submitted a turn
 *  - debate:ended     — match completed or cancelled
 *
 * Events handled here (client → server):
 *  - joinMatch        — client joins a match room
 *  - leaveMatch       — client leaves a match room
 */
const setupDebateSockets = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        socket.on('joinMatch', (matchId) => {
            if (!matchId) return;
            socket.join(`match:${matchId}`);
            console.log(`[Socket] ${socket.id} joined room match:${matchId}`);
            socket.emit('joinedMatch', { matchId });
        });

        socket.on('leaveMatch', (matchId) => {
            if (!matchId) return;
            socket.leave(`match:${matchId}`);
            console.log(`[Socket] ${socket.id} left room match:${matchId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
    });
};

module.exports = setupDebateSockets;
