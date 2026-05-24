import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants';
import { useGameStore } from '../store/game.store';
import { useTimeStore } from '../store/time.store';
import { getAccessToken } from '../services/api';
import type { ActiveEffect, Challenge, GameCard } from '../types';

export function useSocketGame(challengeId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { setConnected, updateChallenge, addCard } = useGameStore();
  const { addActiveEffect } = useTimeStore();

  useEffect(() => {
    if (!challengeId) return;

    let socket: Socket;

    (async () => {
      const token = await getAccessToken();
      socket = io(SOCKET_URL, {
        auth: { token },
        query: { challengeId },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on('challenge:updated', (data: Challenge) => updateChallenge(data));

      socket.on('card:received', (card: GameCard) => {
        addCard(card);
      });

      socket.on('effect:applied', (effect: ActiveEffect) => {
        addActiveEffect(effect);
      });

      socket.on('player:eliminated', (data: { userId: string }) => {
        updateChallenge({ players: useGameStore.getState().challenge?.players.map((p) =>
          p.userId === data.userId ? { ...p, isEliminated: true } : p
        ) ?? [] });
      });
    })();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [challengeId]);

  return socketRef;
}
