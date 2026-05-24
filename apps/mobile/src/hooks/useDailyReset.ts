import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTimeStore } from '../store/time.store';
import { useGameStore } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { gameService } from '../services/game.service';
import { DAILY_RESET_HOUR } from '../constants';

function isNewDay(lastDate: string | null): boolean {
  if (!lastDate) return true;
  const last  = new Date(lastDate);
  const now   = new Date();
  const reset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_RESET_HOUR);
  if (now >= reset && last < reset) return true;
  return now.toDateString() !== last.toDateString() && now >= reset;
}

export function useDailyReset() {
  const { dailyStats, setDailyStats, setCurrentTime, setMaxTime, setStreak } = useTimeStore();
  const { setEventCard } = useGameStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  async function checkAndReset() {
    if (!isAuthenticated) return;
    if (!isNewDay(dailyStats.date)) return;
    try {
      const [eventCard, , state] = await Promise.all([
        gameService.getTodaysEventCard(),
        gameService.getDailyRewards(),
        gameService.getMyPlayerState(),
      ]);
      setEventCard(eventCard);
      setCurrentTime(state.currentTime);
      setMaxTime(state.maxTime);
      setStreak(state.streak);
      setDailyStats({
        date:       new Date().toISOString().split('T')[0],
        clicks:     state.dailyStats.clicks,
        squats:     state.dailyStats.squats,
        steps:      state.dailyStats.steps,
        timeEarned: state.dailyStats.timeEarned,
        timeUsed:   state.dailyStats.timeUsed,
      });
    } catch {
      // Silently handle — will retry next app open or AppState change
    }
  }

  useEffect(() => {
    checkAndReset();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndReset();
    });

    return () => sub.remove();
  }, [isAuthenticated]);
}
