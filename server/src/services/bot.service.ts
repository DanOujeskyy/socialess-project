/**
 * Bot service — day-based realistic simulation.
 *
 * Each bot is assigned a deterministic "survival target" (number of days)
 * derived from its tier using a seeded RNG keyed on `${botId}:${challengeId}`.
 * This makes the target fully reproducible after server restarts without any
 * extra DB columns.
 *
 * Tier targets (real-world days until elimination):
 *   BRONZE    3–7   days  (avg ≈ 5)
 *   SILVER    5–11  days  (avg ≈ 8,  +3 from Bronze)
 *   GOLD      8–15  days  (avg ≈ 11)
 *   PLATINUM  13–23 days  (avg ≈ 18)
 *   DIAMOND   20–40 days  (avg ≈ 30)
 *
 * Bots emit `challenge:player_update` every UPDATE_INTERVAL_MS (10 min)
 * with a linearly-interpolated current time + sinusoidal daily variation
 * so that different bots appear to have their own usage patterns.
 *
 * A global check runs every 15 minutes to eliminate bots whose target day
 * has passed even if no update fired at exactly that moment.
 */

import type { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import { RANKED_SETTINGS } from '../constants';
import { eliminatePlayer } from '../controllers/challenge.controller';

// ── Tier day ranges ────────────────────────────────────────────────────────────

const TIER_DAY_RANGES: Record<string, { min: number; max: number }> = {
  BRONZE:   { min: 3,  max: 7  },
  SILVER:   { min: 5,  max: 11 },
  GOLD:     { min: 8,  max: 15 },
  PLATINUM: { min: 13, max: 23 },
  DIAMOND:  { min: 20, max: 40 },
};

const UPDATE_INTERVAL_MS  = 10 * 60 * 1000; // 10 minutes between UI updates
const CHECK_INTERVAL_MS   = 15 * 60 * 1000; // 15 minutes for elimination sweep

// ── Deterministic seeded RNG (FNV-1a hash) ────────────────────────────────────
// Same botId + challengeId → always same target days, even after restart.

function seededInt(seed: string, min: number, max: number): number {
  let h = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
    h >>>= 0;                   // keep unsigned 32-bit
  }
  return min + (h % (max - min + 1));
}

function getBotTargetDays(botId: string, challengeId: string, tier: string): number {
  const range = TIER_DAY_RANGES[tier.toUpperCase()] ?? TIER_DAY_RANGES.BRONZE;
  return seededInt(`${botId}:${challengeId}:days`, range.min, range.max);
}

// ── Bot simulation state ───────────────────────────────────────────────────────

interface BotSim {
  botId:        string;
  challengeId:  string;
  startingTime: number;       // seconds the bot started with
  startedAt:    number;       // unix ms when the challenge began
  targetDays:   number;       // how many days this bot survives
  maxTime:      number;       // hard cap in seconds
  timer:        ReturnType<typeof setInterval> | null;
  phaseShift:   number;       // sinusoidal phase (0–2π) for daily variation
}

// key: `${botId}:${challengeId}`
const activeSims = new Map<string, BotSim>();

// ── Time computation ───────────────────────────────────────────────────────────

function computeCurrentTime(sim: BotSim, nowMs: number): number {
  const totalMs  = sim.targetDays * 86_400_000;
  const elapsed  = nowMs - sim.startedAt;
  const progress = Math.max(0, Math.min(1, elapsed / totalMs));

  // Linear baseline: starts at startingTime, reaches 0 on target day
  const baseline = sim.startingTime * (1 - progress);

  // Sinusoidal variation simulates daily activity patterns
  // (earns time in morning/evening, spends during the day)
  const dayFraction = (elapsed / 86_400_000) % 1; // 0..1 within current day
  const variation   = Math.sin(dayFraction * Math.PI * 2 + sim.phaseShift)
                      * sim.startingTime * 0.07;   // ±7% swing

  // Small random noise each update tick
  const noise = (Math.random() - 0.5) * sim.startingTime * 0.04; // ±4%

  return Math.max(0, Math.min(sim.maxTime, Math.round(baseline + variation + noise)));
}

// ── Core tick ─────────────────────────────────────────────────────────────────

async function emitUpdate(sim: BotSim, io: Server): Promise<void> {
  const now         = Date.now();
  const currentTime = computeCurrentTime(sim, now);

  io.to(sim.challengeId).emit('challenge:player_update', {
    userId:      sim.botId,
    currentTime,
  });

  // Persist to DB periodically
  try {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    await prisma.playerSession.update({
      where: { userId_date: { userId: sim.botId, date: d } },
      data:  { currentTime },
    });
  } catch { /* bot may not have a session row — ignore */ }

  // Eliminate if target has been reached
  const targetMs = sim.startedAt + sim.targetDays * 86_400_000;
  if (now >= targetMs || currentTime <= 0) {
    await doEliminate(sim, io);
  }
}

async function doEliminate(sim: BotSim, io: Server): Promise<void> {
  const key = `${sim.botId}:${sim.challengeId}`;
  if (sim.timer) { clearInterval(sim.timer); sim.timer = null; }
  activeSims.delete(key);

  try {
    await eliminatePlayer(sim.botId, sim.challengeId, io);
    console.log(`[Bot] Eliminated: bot=${sim.botId} days=${sim.targetDays} challenge=${sim.challengeId}`);
  } catch (err) {
    console.error(`[Bot] Error eliminating ${sim.botId}:`, err);
  }
}

function scheduleUpdates(sim: BotSim, io: Server): void {
  if (sim.timer) clearInterval(sim.timer);
  sim.timer = setInterval(() => {
    emitUpdate(sim, io).catch(console.error);
  }, UPDATE_INTERVAL_MS);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Start a bot simulation when a ranked game begins.
 * @param startedAt  Unix ms timestamp of when the challenge was created
 *                   (defaults to Date.now() — pass challenge.startedAt for accuracy)
 */
export function startBotSimulation(
  botId:        string,
  challengeId:  string,
  rankTier:     string,
  startingTime: number,
  io:           Server,
  startedAt:    number = Date.now(),
): void {
  const key = `${botId}:${challengeId}`;
  if (activeSims.has(key)) return;

  const targetDays = getBotTargetDays(botId, challengeId, rankTier);
  const phaseShift = (seededInt(`${botId}:${challengeId}:phase`, 0, 628)) / 100; // 0–2π

  const sim: BotSim = {
    botId,
    challengeId,
    startingTime,
    startedAt,
    targetDays,
    maxTime: RANKED_SETTINGS.maxTime,
    timer:   null,
    phaseShift,
  };
  activeSims.set(key, sim);

  // Stagger first update: 10–45 seconds, so bots don't all fire simultaneously
  const firstDelay = seededInt(`${botId}:${challengeId}:init`, 10_000, 45_000);
  setTimeout(() => {
    if (!activeSims.has(key)) return;
    emitUpdate(sim, io).catch(console.error);
    scheduleUpdates(sim, io);
  }, firstDelay);

  console.log(
    `[Bot] Simulation started: bot=${botId} tier=${rankTier} ` +
    `targetDays=${targetDays} challenge=${challengeId}`,
  );
}

/**
 * Forcibly stop a bot simulation (e.g. if the challenge is cancelled).
 */
export function stopBotSimulation(botId: string, challengeId: string): void {
  const key = `${botId}:${challengeId}`;
  const sim = activeSims.get(key);
  if (!sim) return;
  if (sim.timer) clearInterval(sim.timer);
  activeSims.delete(key);
}

/**
 * Global check sweep — call every 15 minutes.
 * Eliminates any bots whose target day has passed.
 */
export function startBotCheckInterval(io: Server): void {
  setInterval(async () => {
    const now = Date.now();
    for (const sim of activeSims.values()) {
      const targetMs = sim.startedAt + sim.targetDays * 86_400_000;
      if (now >= targetMs) {
        console.log(`[Bot] Check sweep: eliminating ${sim.botId} (day ${sim.targetDays} reached)`);
        await doEliminate(sim, io).catch(console.error);
      }
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Restore bot simulations after a server restart.
 * Reads all active ranked challenges from the DB and resumes each bot's sim.
 */
export async function restoreActiveBotSimulations(io: Server): Promise<void> {
  try {
    const challenges = await prisma.challenge.findMany({
      where:   { status: 'ACTIVE', mode: 'RANKED' },
      include: {
        players: {
          where:   { isEliminated: false },
          include: { user: true },
        },
      },
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let restored = 0;

    for (const challenge of challenges) {
      const startedAt = (challenge.startedAt ?? challenge.createdAt).getTime();

      for (const cp of challenge.players) {
        if (!(cp.user as any)?.isBot) continue;

        const botId    = cp.userId;
        const rankTier = ((cp.user as any)?.rankTier ?? 'BRONZE') as string;

        const targetDays = getBotTargetDays(botId, challenge.id, rankTier);
        const targetMs   = startedAt + targetDays * 86_400_000;

        if (Date.now() >= targetMs) {
          // Already should have been eliminated
          await eliminatePlayer(botId, challenge.id, io).catch(console.error);
          continue;
        }

        const key = `${botId}:${challenge.id}`;
        if (activeSims.has(key)) continue;

        const phaseShift = seededInt(`${botId}:${challenge.id}:phase`, 0, 628) / 100;
        const sim: BotSim = {
          botId,
          challengeId:  challenge.id,
          startingTime: RANKED_SETTINGS.startingTime,
          startedAt,
          targetDays,
          maxTime:      RANKED_SETTINGS.maxTime,
          timer:        null,
          phaseShift,
        };
        activeSims.set(key, sim);
        scheduleUpdates(sim, io);
        restored++;
      }
    }

    console.log(`[Bot] Restored ${restored} bot simulation(s) from ${challenges.length} active challenge(s)`);
  } catch (err) {
    console.error('[Bot] Error restoring simulations:', err);
  }
}

// ── Find available bots ────────────────────────────────────────────────────────

export async function findAvailableBots(
  count:      number,
  rankPoints: number,
): Promise<{ id: string; username: string; rankPoints: number; rankTier: string }[]> {
  // Bots already in active ranked games are excluded
  const busyIds = (await prisma.challengePlayer.findMany({
    where:  { challenge: { status: 'ACTIVE', mode: 'RANKED' }, user: { isBot: true } },
    select: { userId: true },
  })).map((r) => r.userId);

  const bots = await prisma.user.findMany({
    where: {
      isBot: true,
      ...(busyIds.length > 0 ? { id: { notIn: busyIds } } : {}),
    },
    select: { id: true, username: true, rankPoints: true, rankTier: true },
  });

  if (bots.length === 0) return [];

  // Prefer bots close in rank, shuffle for variety within each band
  const result = bots
    .map((b) => ({ ...b, rankTier: b.rankTier as string, diff: Math.abs(b.rankPoints - rankPoints) }))
    .sort(() => Math.random() - 0.5)          // shuffle first
    .sort((a, b) => {
      const aClose = a.diff <= 600 ? 0 : 1;
      const bClose = b.diff <= 600 ? 0 : 1;
      return aClose - bClose || a.diff - b.diff;
    });

  return result.slice(0, count);
}
