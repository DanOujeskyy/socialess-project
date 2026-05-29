/**
 * game.socket.ts — real-time game events
 *
 * Ranked matchmaking:
 *   • Players join a queue and are placed into a shared pending room.
 *   • Every 4–8 seconds a bot joins to fill empty slots (looks like real players).
 *   • Real players are always preferred over bots — if two real players are
 *     close in rank they share the same room.
 *   • After 30 s (LOBBY_FILL_TIME_MS) the room force-starts with however many
 *     players joined (minimum 2).
 *   • When the room hits RANKED_LOBBY_SIZE the game starts immediately.
 *
 * Disconnect / permission removal:
 *   • If a player disconnects during an ACTIVE ranked match, they get a 30-second
 *     grace period to reconnect.  If they don't return in time they are eliminated
 *     just like any other player who ran out of time.
 */

import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import {
  RANKED_SETTINGS,
  MAX_CARDS_PER_PLAYER,
  RANKED_LOBBY_SIZE,
  LOBBY_FILL_TIME_MS,
} from '../constants';
import { endChallenge, eliminatePlayer } from '../controllers/challenge.controller';
import { generateEventCard, rollCardType, rollRarity } from '../services/session.service';
import { findAvailableBots, startBotSimulation } from '../services/bot.service';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthSocket extends Socket {
  userId?: string;
}

interface QueueEntry {
  userId:     string;
  username:   string;
  rankPoints: number;
  rankTier:   string;
  socket:     AuthSocket;
  joinedAt:   number;
}

interface LobbyPlayer {
  userId:     string;
  username:   string;
  rankTier:   string;
  rankPoints: number;
  isBot:      boolean;
}

interface PendingRoom {
  id:           string;           // random key, used only for logging
  players:      LobbyPlayer[];    // all players (real + bot)
  realEntries:  QueueEntry[];     // real player connections
  botIds:       Set<string>;      // bots already added (avoid duplicates)
  startTimeout: ReturnType<typeof setTimeout>;
  cancelled:    boolean;          // set to true once the room has started
  createdAt:    number;
}

// ── Module-level state ─────────────────────────────────────────────────────────

const queue: QueueEntry[] = [];
const pendingRooms: PendingRoom[] = [];

// userId → timeout that will eliminate them if they don't reconnect (active game)
const pendingEliminations = new Map<string, ReturnType<typeof setTimeout>>();

// userId → timeout that removes them from a pending lobby if they don't reconnect
const pendingLobbyDrops = new Map<string, ReturnType<typeof setTimeout>>();

const DISCONNECT_GRACE_MS      = 30_000; // 30 s to reconnect before elimination (active game)
const LOBBY_DISCONNECT_GRACE_MS = 12_000; // 12 s to reconnect before lobby removal

// ── Helpers ────────────────────────────────────────────────────────────────────

function removeFromQueue(userId: string) {
  const idx = queue.findIndex((e) => e.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);
}

function removeFromPendingRooms(userId: string) {
  for (const room of pendingRooms) {
    const eIdx = room.realEntries.findIndex((e) => e.userId === userId);
    if (eIdx !== -1) {
      room.realEntries.splice(eIdx, 1);
      const pIdx = room.players.findIndex((p) => p.userId === userId);
      if (pIdx !== -1) room.players.splice(pIdx, 1);
      broadcastLobbyUpdate(room);
      break;
    }
  }
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Lobby broadcast ────────────────────────────────────────────────────────────

function broadcastLobbyUpdate(room: PendingRoom, status: 'filling' | 'starting' = 'filling') {
  const payload = {
    players: room.players.map((p) => ({
      username:   p.username,
      rankTier:   p.rankTier,
      rankPoints: p.rankPoints,
    })),
    count:  room.players.length,
    total:  RANKED_LOBBY_SIZE,
    status,
  };
  for (const entry of room.realEntries) {
    entry.socket.emit('ranked:lobby_update', payload);
  }
}

// ── Start a room (create challenge + notify all) ───────────────────────────────

async function startRoom(room: PendingRoom, io: Server) {
  if (room.cancelled) return;
  room.cancelled = true;
  clearTimeout(room.startTimeout);

  const idx = pendingRooms.indexOf(room);
  if (idx !== -1) pendingRooms.splice(idx, 1);

  if (room.players.length < 2) {
    // Not enough players — put real players back in queue
    for (const entry of room.realEntries) {
      queue.push(entry);
      entry.socket.emit('ranked:status', { status: 'queued', position: queue.length });
    }
    return;
  }

  // Signal "starting" briefly
  broadcastLobbyUpdate(room, 'starting');
  await new Promise((r) => setTimeout(r, 1_500));

  // Create challenge
  let code: string;
  do { code = generateCode(); }
  while (await prisma.challenge.findUnique({ where: { code } }));

  const allIds = room.players.map((p) => p.userId);
  const today  = todayDate();

  const challenge = await prisma.challenge.create({
    data: {
      code,
      mode:      'RANKED',
      hostId:    room.realEntries[0]?.userId ?? allIds[0],
      status:    'ACTIVE',
      startedAt: new Date(),
      settings:  RANKED_SETTINGS,
      players:   { create: allIds.map((userId) => ({ userId })) },
    },
    include: { players: { include: { user: true } } },
  });

  // Grant starting time + cards to every participant
  for (const cp of challenge.players) {
    await prisma.playerSession.upsert({
      where:  { userId_date: { userId: cp.userId, date: today } },
      create: { userId: cp.userId, date: today, currentTime: RANKED_SETTINGS.startingTime, maxTime: RANKED_SETTINGS.maxTime, freeTimeGiven: true },
      update: { currentTime: RANKED_SETTINGS.startingTime, maxTime: RANKED_SETTINGS.maxTime },
    });

    const isBot = !!(cp.user as any)?.isBot;
    if (!isBot && RANKED_SETTINGS.startingCards > 0) {
      const existing = await prisma.gameCard.count({ where: { userId: cp.userId, usedAt: null } });
      const toGive = Math.min(RANKED_SETTINGS.startingCards, MAX_CARDS_PER_PLAYER - existing);
      for (let k = 0; k < toGive; k++) {
        const rarity   = rollRarity();
        const cardType = rollCardType(false);
        if (cardType) {
          await prisma.gameCard.create({
            data: {
              userId:            cp.userId,
              type:              cardType.toUpperCase() as any,
              rarity:            rarity.toUpperCase() as any,
              effectValue:       1,
              usedInChallengeId: challenge.id,
            },
          });
        }
      }
    }
  }

  // Unique event card for this lobby
  await generateEventCard(undefined, challenge.id);

  // Build formatted challenge for the client
  const sessions = await prisma.playerSession.findMany({
    where: { userId: { in: allIds }, date: today },
  });
  const sessionMap = new Map(sessions.map((s) => [s.userId, s]));

  const formattedChallenge = {
    id:        challenge.id,
    code:      challenge.code,
    mode:      'ranked',
    hostId:    challenge.hostId,
    status:    'active',
    settings:  challenge.settings,
    penalties: null,
    createdAt: challenge.createdAt,
    startedAt: challenge.startedAt,
    endedAt:   null,
    players:   challenge.players.map((cp) => ({
      userId:        cp.userId,
      username:      cp.user?.username ?? '',
      avatar:        cp.user?.avatar ?? null,
      currentTime:   sessionMap.get(cp.userId)?.currentTime ?? RANKED_SETTINGS.startingTime,
      maxTime:       RANKED_SETTINGS.maxTime,
      activeEffects: [],
      cards:         [],
      dailyStats:    { date: today, clicks: 0, squats: 0, steps: 0, timeEarned: 0, timeUsed: 0 },
      streak:        (cp.user as any)?.currentStreak ?? 0,
      isEliminated:  false,
      rankPoints:    (cp.user as any)?.rankPoints ?? 0,
      rankTier:      ((cp.user as any)?.rankTier ?? 'BRONZE').toLowerCase(),
    })),
  };

  // Notify real players
  for (const entry of room.realEntries) {
    entry.socket.join(challenge.id);
    entry.socket.emit('ranked:matched', { challenge: formattedChallenge });
  }

  console.log(
    `[Ranked] Started: challenge=${challenge.id} total=${room.players.length} ` +
    `real=${room.realEntries.length} bots=${room.players.length - room.realEntries.length}`,
  );

  // Start bot simulations — pass the challenge's actual start timestamp so the
  // day-based survival calculation is reproducible after server restarts.
  const challengeStartedAt = (challenge.startedAt ?? new Date()).getTime();
  for (const player of room.players) {
    if (!player.isBot) continue;
    startBotSimulation(
      player.userId,
      challenge.id,
      player.rankTier,
      RANKED_SETTINGS.startingTime,
      io,
      challengeStartedAt,
    );
  }
}

// ── Progressive bot fill for a room ───────────────────────────────────────────

async function scheduleBotFill(room: PendingRoom, io: Server) {
  if (room.cancelled || room.players.length >= RANKED_LOBBY_SIZE) return;

  const delay = rng(4_000, 8_000);
  setTimeout(async () => {
    if (room.cancelled || room.players.length >= RANKED_LOBBY_SIZE) return;

    const botsToAdd = rng(1, 2);
    const avgRank = room.players.length > 0
      ? room.players.reduce((s, p) => s + p.rankPoints, 0) / room.players.length
      : 1000;

    const available = await findAvailableBots(botsToAdd + 4, avgRank);

    // Filter out bots already in this room
    const fresh = available.filter((b) => !room.botIds.has(b.id));

    for (let i = 0; i < Math.min(botsToAdd, fresh.length); i++) {
      if (room.cancelled || room.players.length >= RANKED_LOBBY_SIZE) break;

      const bot = fresh[i];
      room.botIds.add(bot.id);
      room.players.push({
        userId:     bot.id,
        username:   bot.username,
        rankTier:   bot.rankTier.toLowerCase(),
        rankPoints: bot.rankPoints,
        isBot:      true,
      });

      broadcastLobbyUpdate(room);

      // Brief pause between each bot "joining" (0.6–1.8 s)
      await new Promise((r) => setTimeout(r, rng(600, 1_800)));
    }

    if (!room.cancelled && room.players.length >= RANKED_LOBBY_SIZE) {
      startRoom(room, io).catch(console.error);
    } else if (!room.cancelled) {
      scheduleBotFill(room, io); // schedule next wave
    }
  }, delay);
}

// ── Place a real player in an existing or new pending room ────────────────────

async function enqueuePlayer(entry: QueueEntry, io: Server) {
  // Try to join an existing room that still has space and isn't starting yet
  let room = pendingRooms.find(
    (r) => !r.cancelled && r.players.length < RANKED_LOBBY_SIZE,
  );

  if (!room) {
    // Create a new room
    const startTimeout = setTimeout(async () => {
      if (!room || room.cancelled) return;
      // Time's up — fill remaining slots with bots then start
      const needed = RANKED_LOBBY_SIZE - room.players.length;
      if (needed > 0) {
        const avgRank = room.players.length > 0
          ? room.players.reduce((s, p) => s + p.rankPoints, 0) / room.players.length
          : 1000;
        const bots = await findAvailableBots(needed + 4, avgRank);
        const fresh = bots.filter((b) => !room!.botIds.has(b.id));

        for (const bot of fresh.slice(0, needed)) {
          if (room!.cancelled || room!.players.length >= RANKED_LOBBY_SIZE) break;
          room!.botIds.add(bot.id);
          room!.players.push({
            userId: bot.id, username: bot.username,
            rankTier: bot.rankTier.toLowerCase(), rankPoints: bot.rankPoints,
            isBot: true,
          });
          broadcastLobbyUpdate(room!);
          await new Promise((r2) => setTimeout(r2, rng(400, 900)));
        }
      }
      if (!room!.cancelled) {
        startRoom(room!, io).catch(console.error);
      }
    }, LOBBY_FILL_TIME_MS);

    room = {
      id:           `room_${Date.now()}`,
      players:      [],
      realEntries:  [],
      botIds:       new Set(),
      startTimeout,
      cancelled:    false,
      createdAt:    Date.now(),
    };
    pendingRooms.push(room);

    // Begin progressive bot fill
    scheduleBotFill(room, io);
  }

  // Add the real player
  room.players.push({
    userId:     entry.userId,
    username:   entry.username,
    rankTier:   entry.rankTier,
    rankPoints: entry.rankPoints,
    isBot:      false,
  });
  room.realEntries.push(entry);

  broadcastLobbyUpdate(room);

  if (room.players.length >= RANKED_LOBBY_SIZE) {
    startRoom(room, io).catch(console.error);
  }
}

// ── Main init ──────────────────────────────────────────────────────────────────

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

    // ── Reconnect — cancel any pending elimination (active game) ───────────
    const pendingTimer = pendingEliminations.get(userId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingEliminations.delete(userId);
      console.log(`[Reconnect] ${userId} reconnected — elimination cancelled`);
    }

    // ── Reconnect — restore lobby slot if reconnecting during matchmaking ──
    const lobbyDropTimer = pendingLobbyDrops.get(userId);
    if (lobbyDropTimer) {
      clearTimeout(lobbyDropTimer);
      pendingLobbyDrops.delete(userId);

      // Find the pending room this player was in and update their socket ref
      const room = pendingRooms.find(
        (r) => !r.cancelled && r.players.some((p) => p.userId === userId && !p.isBot),
      );
      if (room) {
        const eIdx = room.realEntries.findIndex((e) => e.userId === userId);
        if (eIdx !== -1) {
          room.realEntries[eIdx].socket = socket;
          broadcastLobbyUpdate(room); // re-send current lobby state to the reconnected client
          console.log(`[Reconnect] ${userId} restored to pending lobby`);
        }
      }
    }

    socket.join(`user:${userId}`);

    const challengeId = socket.handshake.query.challengeId as string | undefined;
    if (challengeId) socket.join(challengeId);

    socket.on('challenge:join',  (id: string) => socket.join(id));
    socket.on('challenge:leave', (id: string) => socket.leave(id));

    // ── Ranked matchmaking ─────────────────────────────────────────────────

    socket.on('ranked:queue', async () => {
      removeFromQueue(userId);
      removeFromPendingRooms(userId);

      const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, username: true, rankPoints: true, rankTier: true },
      });
      if (!user) return;

      const entry: QueueEntry = {
        userId:     user.id,
        username:   user.username,
        rankPoints: user.rankPoints,
        rankTier:   user.rankTier.toLowerCase(),
        socket,
        joinedAt:   Date.now(),
      };
      queue.push(entry);

      socket.emit('ranked:status', { status: 'queued' });
      await enqueuePlayer(entry, io).catch(console.error);
      removeFromQueue(userId); // clear from simple queue — room now manages this player
    });

    socket.on('ranked:cancel', () => {
      removeFromQueue(userId);
      removeFromPendingRooms(userId);
      socket.emit('ranked:status', { status: 'cancelled' });
    });

    // ── Voluntary give-up ──────────────────────────────────────────────────

    socket.on('player:giveup', async ({ challengeId: cid }: { challengeId: string }) => {
      const cp = await prisma.challengePlayer.findUnique({
        where: { challengeId_userId: { challengeId: cid, userId } },
      });
      if (cp && !cp.isEliminated) {
        await eliminatePlayer(userId, cid, io);
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      removeFromQueue(userId);

      // ── Pending lobby grace period ─────────────────────────────────────
      // Don't immediately remove from the matchmaking lobby — the client
      // reconnects within seconds (singleton socket + reconnection: true).
      const lobbyRoom = pendingRooms.find(
        (r) => !r.cancelled && r.realEntries.some((e) => e.userId === userId),
      );
      if (lobbyRoom) {
        const timer = setTimeout(() => {
          pendingLobbyDrops.delete(userId);
          removeFromPendingRooms(userId);
          console.log(`[Disconnect] Lobby grace expired for ${userId} — removed from pending room`);
        }, LOBBY_DISCONNECT_GRACE_MS);
        pendingLobbyDrops.set(userId, timer);
        console.log(`[Disconnect] ${userId} left lobby — ${LOBBY_DISCONNECT_GRACE_MS / 1000}s grace`);
      } else {
        removeFromPendingRooms(userId);
      }

      // ── Active game grace period ──────────────────────────────────────
      try {
        const activeCp = await prisma.challengePlayer.findFirst({
          where: {
            userId,
            isEliminated: false,
            challenge:    { status: 'ACTIVE', mode: 'RANKED' },
          },
          select: { challengeId: true },
        });

        if (activeCp) {
          const timer = setTimeout(async () => {
            pendingEliminations.delete(userId);
            console.log(`[Disconnect] Grace expired for ${userId} — eliminating`);
            await eliminatePlayer(userId, activeCp.challengeId, io).catch(console.error);
          }, DISCONNECT_GRACE_MS);

          pendingEliminations.set(userId, timer);
          console.log(`[Disconnect] ${userId} disconnected from active game — ${DISCONNECT_GRACE_MS / 1000}s grace`);
        }
      } catch (err) {
        console.error('[Disconnect] DB error:', err);
      }
    });
  });
}
