import { create } from 'zustand';
import type { Challenge, EventCard, GameCard, GameMode, GameResults, MatchmakingStatus, Crate } from '../types';
import { MAX_CARDS_PER_PLAYER } from '../constants';

interface GameStore {
  mode: GameMode | null;
  challenge: Challenge | null;
  currentEventCard: EventCard | null;
  myCards: GameCard[];
  myCrates: Crate[];
  cratesAvailable: number;
  hasFreeCrateAvailable: boolean;  // daily free crate, resets each day
  hasAdCrateAvailable: boolean;
  hasSpunToday: boolean;
  hasAdSpinAvailable: boolean;
  isConnected: boolean;

  // ── Ranked Matchmaking ───────────────────────────────────────────────────
  matchmakingStatus: MatchmakingStatus;
  rankedLobby: { players: { username: string; rankTier: string; rankPoints: number }[]; count: number; total: number; status: 'filling' | 'starting' | 'idle' };

  // ── Game Results ─────────────────────────────────────────────────────────
  gameResults: GameResults | null;

  // ── Daily Pass ──────────────────────────────────────────────────────────
  isPassActive:       boolean;
  passStartDate:      string;   // 'YYYY-MM-DD' when subscription started; '' if never
  passLastClaimDate:  string;   // 'YYYY-MM-DD' of last claim; '' if never claimed
  passClaimedDays:    number[]; // day numbers (1–30) successfully claimed

  // Card overflow: set when a new card arrives but player already has MAX_CARDS_PER_PLAYER
  cardOverflow: GameCard | null;

  setMode: (mode: GameMode | null) => void;
  setChallenge: (challenge: Challenge | null) => void;
  updateChallenge: (updates: Partial<Challenge>) => void;
  setEventCard: (card: EventCard | null) => void;
  setMyCards: (cards: GameCard[]) => void;
  addCard: (card: GameCard) => void;
  removeCard: (cardId: string) => void;
  setCardOverflow: (card: GameCard | null) => void;
  /** Discard a held card to make room, then add the overflow card */
  resolveCardOverflow: (discardId: string) => void;
  setMyCrates: (crates: Crate[]) => void;
  addCrate: (crate: Crate) => void;
  openCrate: (crateId: string, reward: GameCard) => void;
  setHasFreeCrateAvailable: (v: boolean) => void;
  setHasAdCrateAvailable: (v: boolean) => void;
  setHasSpunToday: (v: boolean) => void;
  setHasAdSpinAvailable: (v: boolean) => void;
  setConnected: (v: boolean) => void;
  setMatchmakingStatus: (status: MatchmakingStatus) => void;
  setRankedLobby: (players: { username: string; rankTier: string; rankPoints: number }[], count: number, total: number, status: 'filling' | 'starting' | 'idle') => void;
  updatePlayerInChallenge: (userId: string, currentTime: number) => void;
  setGameResults: (results: GameResults | null) => void;
  // Call when a multiplayer game ends (win or lose) — clears all in-game cards/inventory.
  endGame: () => void;
  leaveGame: () => void;

  // ── Pass actions ────────────────────────────────────────────────────────
  activatePass:   () => void;
  deactivatePass: () => void;
  claimPassDay:   (day: number) => void;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const useGameStore = create<GameStore>((set) => ({
  mode: 'singleplayer',
  challenge: null,
  currentEventCard: null,
  myCards: [],
  cardOverflow: null,
  myCrates: [],
  cratesAvailable: 0,
  hasFreeCrateAvailable: true,
  hasAdCrateAvailable: false,
  hasSpunToday: false,
  hasAdSpinAvailable: false,
  isConnected: false,
  matchmakingStatus: 'idle',
  rankedLobby: { players: [], count: 0, total: 10, status: 'idle' },
  gameResults: null,

  // ── Pass defaults ──────────────────────────────────────────────────────
  isPassActive:      false,
  passStartDate:     '',
  passLastClaimDate: '',
  passClaimedDays:   [],

  setMode: (mode) => set({ mode }),
  setChallenge: (challenge) => set({ challenge }),
  updateChallenge: (updates) =>
    set((state) => ({
      challenge: state.challenge ? { ...state.challenge, ...updates } : null,
    })),
  setEventCard: (currentEventCard) => set({ currentEventCard }),
  setMyCards: (myCards) => set({ myCards }),
  addCard: (card) =>
    set((state) => {
      if (state.myCards.length >= MAX_CARDS_PER_PLAYER) {
        // Slot full — hold new card in overflow until player discards one
        return { cardOverflow: card };
      }
      return { myCards: [...state.myCards, card] };
    }),
  removeCard: (cardId) =>
    set((state) => ({ myCards: state.myCards.filter((c) => c.id !== cardId) })),
  setCardOverflow: (card) => set({ cardOverflow: card }),
  resolveCardOverflow: (discardId) =>
    set((state) => {
      const filtered = state.myCards.filter((c) => c.id !== discardId);
      return {
        myCards:      state.cardOverflow ? [...filtered, state.cardOverflow] : filtered,
        cardOverflow: null,
      };
    }),
  setMyCrates: (myCrates) => set({ myCrates }),
  addCrate: (crate) => set((state) => ({ myCrates: [...state.myCrates, crate] })),
  openCrate: (crateId, reward) =>
    set((state) => ({
      myCrates: state.myCrates.map((c) =>
        c.id === crateId ? { ...c, opened: true, reward } : c,
      ),
    })),
  setHasFreeCrateAvailable: (v) => set({ hasFreeCrateAvailable: v }),
  setHasAdCrateAvailable: (v) => set({ hasAdCrateAvailable: v }),
  setHasSpunToday: (v) => set({ hasSpunToday: v }),
  setHasAdSpinAvailable: (v) => set({ hasAdSpinAvailable: v }),
  setConnected: (v) => set({ isConnected: v }),
  setMatchmakingStatus: (status) => set({ matchmakingStatus: status }),
  setRankedLobby: (players, count, total, status) =>
    set({ rankedLobby: { players, count, total, status } }),
  updatePlayerInChallenge: (userId, currentTime) =>
    set((state) => ({
      challenge: state.challenge
        ? {
            ...state.challenge,
            players: state.challenge.players.map((p) =>
              p.userId === userId ? { ...p, currentTime } : p,
            ),
          }
        : null,
    })),
  setGameResults: (results) => set({ gameResults: results }),
  endGame: () =>
    set({ challenge: null, mode: 'singleplayer', currentEventCard: null, myCards: [], cardOverflow: null, isConnected: false, matchmakingStatus: 'idle', rankedLobby: { players: [], count: 0, total: 10, status: 'idle' } }),
  leaveGame: () =>
    set({ challenge: null, mode: 'singleplayer', currentEventCard: null, myCards: [], cardOverflow: null, isConnected: false, matchmakingStatus: 'idle', rankedLobby: { players: [], count: 0, total: 10, status: 'idle' } }),

  // ── Pass actions ──────────────────────────────────────────────────────
  activatePass: () =>
    set((state) => ({
      isPassActive:  true,
      // Only set the start date on fresh activation; preserve it on renewals
      passStartDate: state.passStartDate || todayISO(),
    })),
  deactivatePass: () => set({ isPassActive: false }),
  claimPassDay: (day) =>
    set((state) => ({
      passLastClaimDate: todayISO(),
      passClaimedDays:   state.passClaimedDays.includes(day)
        ? state.passClaimedDays
        : [...state.passClaimedDays, day],
    })),
}));
