import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { router } from 'expo-router';
import { SOCKET_URL } from '../constants';
import { useGameStore } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { useTimeStore } from '../store/time.store';
import { getAccessToken } from '../services/api';
import type { ActiveEffect, Challenge, GameCard, GameResults } from '../types';

// ── Singleton global socket ────────────────────────────────────────────────────
// One socket per user session shared across ALL screens.  Creating multiple
// sockets from different screens was the root cause of lobby-update events
// being delivered to a stale socket while the matchmaking screen listened
// on a fresh one that never received those events.

let _globalSocket: Socket | null = null;
let _socketPromise: Promise<Socket> | null = null;

export async function getOrCreateSocket(): Promise<Socket> {
  if (_globalSocket?.connected) return _globalSocket;

  // If a connection attempt is already in-flight, reuse its promise
  if (_socketPromise) return _socketPromise;

  _socketPromise = (async () => {
    const token = await getAccessToken();
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    _globalSocket = socket;
    _socketPromise = null;
    return socket;
  })();

  return _socketPromise;
}

/** Disconnect the global socket (call only on logout). */
export function disconnectSocket() {
  _globalSocket?.disconnect();
  _globalSocket  = null;
  _socketPromise = null;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSocketGame(challengeId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnected, updateChallenge, addCard,
    setMode, setChallenge, endGame, setGameResults, setMatchmakingStatus,
    setRankedLobby, updatePlayerInChallenge,
  } = useGameStore();
  const { addActiveEffect, setCurrentTime, setMaxTime } = useTimeStore();

  useEffect(() => {
    let mounted = true;

    // ── Named handlers so socket.off() removes the right function ───────────
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onChallengeUpdated = (data: Challenge) => {
      updateChallenge(data);
      if (data.status === 'active') router.replace('/(app)/(tabs)');
    };

    const onHostTransferred = ({ newHostId }: { newHostId: string }) => {
      updateChallenge({ hostId: newHostId });
    };

    const onCardReceived    = (card: GameCard)        => addCard(card);
    const onEffectApplied   = (effect: ActiveEffect)  => addActiveEffect(effect);

    const onPlayerEliminated = ({ userId: eliminatedId }: { userId: string }) => {
      updateChallenge({
        players: useGameStore.getState().challenge?.players.map((p) =>
          p.userId === eliminatedId ? { ...p, isEliminated: true } : p,
        ) ?? [],
      });
    };

    const onPlayerUpdate = ({ userId: uid, currentTime }: { userId: string; currentTime: number }) => {
      updatePlayerInChallenge(uid, currentTime);
    };

    const onRankedEliminationResult = ({
      newRankPoints, newRankTier,
    }: { placement: number; pointsChange: number; newRankPoints: number; newRankTier: string }) => {
      useAuthStore.getState().updateUser({ rankPoints: newRankPoints, rankTier: newRankTier } as any);
    };

    const onChallengeEnded = (results: GameResults) => {
      setGameResults(results);
      endGame();
      router.replace('/(app)/game-results' as any);
    };

    const onRankedStatus = ({ status }: { status: string }) => {
      if (status === 'queued')    setMatchmakingStatus('queued');
      if (status === 'cancelled') setMatchmakingStatus('idle');
    };

    const onRankedLobbyUpdate = ({
      players, count, total, status,
    }: {
      players: { username: string; rankTier: string; rankPoints: number }[];
      count: number; total: number; status: 'filling' | 'starting';
    }) => {
      setRankedLobby(players, count, total, status);
    };

    const onRankedMatched = ({ challenge }: { challenge: Challenge }) => {
      setChallenge(challenge);
      setMode('ranked');
      setRankedLobby([], 0, 10, 'idle');
      const myUserId = useAuthStore.getState().user?.id;
      const myPlayer = challenge.players.find((p) => p.userId === myUserId) ?? challenge.players[0];
      if (myPlayer) {
        setCurrentTime(myPlayer.currentTime);
        setMaxTime(myPlayer.maxTime);
      }
      // Signal the matchmaking screen — it watches matchmakingStatus and calls
      // router.back() itself (the correct way to dismiss a fullscreen modal).
      setMatchmakingStatus('matched');
    };

    // ── Connect (or reuse) the singleton socket ──────────────────────────────
    (async () => {
      const socket = await getOrCreateSocket();
      if (!mounted) return;

      socketRef.current = socket;

      // Join the challenge room if we have one (may be a no-op if already joined)
      if (challengeId) socket.emit('challenge:join', challengeId);

      // Attach named listeners (idempotent — socket.io deduplicates by reference)
      socket.on('connect',                 onConnect);
      socket.on('disconnect',              onDisconnect);
      socket.on('challenge:updated',       onChallengeUpdated);
      socket.on('host:transferred',        onHostTransferred);
      socket.on('card:received',           onCardReceived);
      socket.on('effect:applied',          onEffectApplied);
      socket.on('player:eliminated',       onPlayerEliminated);
      socket.on('challenge:player_update', onPlayerUpdate);
      socket.on('ranked:elimination_result', onRankedEliminationResult);
      socket.on('challenge:ended',         onChallengeEnded);
      socket.on('ranked:status',           onRankedStatus);
      socket.on('ranked:lobby_update',     onRankedLobbyUpdate);
      socket.on('ranked:matched',          onRankedMatched);

      // Sync connected state if socket was already connected before the hook mounted
      if (socket.connected) setConnected(true);
    })();

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      mounted = false;
      const socket = socketRef.current;
      if (!socket) return;

      // Remove this hook instance's listeners — other instances keep theirs
      socket.off('connect',                 onConnect);
      socket.off('disconnect',              onDisconnect);
      socket.off('challenge:updated',       onChallengeUpdated);
      socket.off('host:transferred',        onHostTransferred);
      socket.off('card:received',           onCardReceived);
      socket.off('effect:applied',          onEffectApplied);
      socket.off('player:eliminated',       onPlayerEliminated);
      socket.off('challenge:player_update', onPlayerUpdate);
      socket.off('ranked:elimination_result', onRankedEliminationResult);
      socket.off('challenge:ended',         onChallengeEnded);
      socket.off('ranked:status',           onRankedStatus);
      socket.off('ranked:lobby_update',     onRankedLobbyUpdate);
      socket.off('ranked:matched',          onRankedMatched);

      // Leave the challenge room but NEVER disconnect the global socket from here.
      // The socket stays alive for the entire user session; only disconnectSocket()
      // (called on logout) should sever the connection.
      if (challengeId) socket.emit('challenge:leave', challengeId);
    };
  }, [challengeId]);

  return socketRef;
}

/** Emit an event through the global socket (fire-and-forget). */
export function emitToSocket(event: string, data?: any) {
  _globalSocket?.emit(event, data);
}
