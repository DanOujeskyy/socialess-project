import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthSocket extends Socket {
  userId?: string;
}

export function initSocketGame(io: Server) {
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) { next(new Error('Unauthorized')); return; }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;

    // Join personal room for targeted notifications
    socket.join(`user:${userId}`);

    // Join challenge room if provided
    const challengeId = socket.handshake.query.challengeId as string | undefined;
    if (challengeId) socket.join(challengeId);

    socket.on('challenge:join', (id: string) => socket.join(id));
    socket.on('challenge:leave', (id: string) => socket.leave(id));

    socket.on('disconnect', () => {
      // Could mark player as disconnected in DB here
    });
  });
}
