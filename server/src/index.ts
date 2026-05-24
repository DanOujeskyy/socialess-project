import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { router } from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { initSocketGame } from './socket/game.socket';

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN ?? '*', credentials: true },
});

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.use('/api', router);
app.use(errorMiddleware);

initSocketGame(io);

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`Socialess server running on port ${PORT}`);
});

export { io };
