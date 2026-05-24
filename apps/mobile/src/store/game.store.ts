import { create } from 'zustand';
import type { Challenge, EventCard, GameCard, GameMode, Crate } from '../types';

interface GameStore {
  mode: GameMode | null;
  challenge: Challenge | null;
  currentEventCard: EventCard | null;
  myCards: GameCard[];
  myCrates: Crate[];
  cratesAvailable: number;
  hasAdCrateAvailable: boolean;
  hasSpunToday: boolean;
  hasAdSpinAvailable: boolean;
  isConnected: boolean;

  setMode: (mode: GameMode | null) => void;
  setChallenge: (challenge: Challenge | null) => void;
  updateChallenge: (updates: Partial<Challenge>) => void;
  setEventCard: (card: EventCard | null) => void;
  setMyCards: (cards: GameCard[]) => void;
  addCard: (card: GameCard) => void;
  removeCard: (cardId: string) => void;
  setMyCrates: (crates: Crate[]) => void;
  addCrate: (crate: Crate) => void;
  openCrate: (crateId: string, reward: GameCard) => void;
  setHasAdCrateAvailable: (v: boolean) => void;
  setHasSpunToday: (v: boolean) => void;
  setHasAdSpinAvailable: (v: boolean) => void;
  setConnected: (v: boolean) => void;
  leaveGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  mode: null,
  challenge: null,
  currentEventCard: null,
  myCards: [],
  myCrates: [],
  cratesAvailable: 0,
  hasAdCrateAvailable: false,
  hasSpunToday: false,
  hasAdSpinAvailable: false,
  isConnected: false,

  setMode: (mode) => set({ mode }),
  setChallenge: (challenge) => set({ challenge }),
  updateChallenge: (updates) =>
    set((state) => ({
      challenge: state.challenge ? { ...state.challenge, ...updates } : null,
    })),
  setEventCard: (currentEventCard) => set({ currentEventCard }),
  setMyCards: (myCards) => set({ myCards }),
  addCard: (card) => set((state) => ({ myCards: [...state.myCards, card] })),
  removeCard: (cardId) =>
    set((state) => ({ myCards: state.myCards.filter((c) => c.id !== cardId) })),
  setMyCrates: (myCrates) => set({ myCrates }),
  addCrate: (crate) => set((state) => ({ myCrates: [...state.myCrates, crate] })),
  openCrate: (crateId, reward) =>
    set((state) => ({
      myCrates: state.myCrates.map((c) =>
        c.id === crateId ? { ...c, opened: true, reward } : c,
      ),
    })),
  setHasAdCrateAvailable: (v) => set({ hasAdCrateAvailable: v }),
  setHasSpunToday: (v) => set({ hasSpunToday: v }),
  setHasAdSpinAvailable: (v) => set({ hasAdSpinAvailable: v }),
  setConnected: (v) => set({ isConnected: v }),
  leaveGame: () =>
    set({ challenge: null, mode: null, currentEventCard: null, myCards: [], isConnected: false }),
}));
