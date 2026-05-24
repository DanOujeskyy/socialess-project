import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTimeStore } from '../store/time.store';
import { useGameStore } from '../store/game.store';
import { gameService } from '../services/game.service';
import { DAILY_RESET_HOUR } from '../constants';

function isNewDay(lastDate: string | null): boolean {
  if (!lastDate) return true;
  const last  = new Date(lastDate);
  const now   = new Date();
  const reset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_RESET_HOUR);
  // If we've crossed the 4 AM boundary since last date
  if (now >= reset && last < reset) return true;
  return now.toDateString() !== last.toDateString() && now >= reset;
}

export function useDailyReset() {
  const { dailyStats, setDailyStats } = useTimeStore();
  const { setEventCard } = useGameStore();

  async function checkAndReset() {
    if (!isNewDay(dailyStats.date)) return;
    try {
      const [eventCard] = await Promise.all([
        gameService.getTodaysEventCard(),
        gameService.getDailyRewards(),
      ]);
      setEventCard(eventCard);
      setDailyStats({
        date:       new Date().toISOString().split('T')[0],
        clicks:     0,
        squats:     0,
        steps:      0,
        timeEarned: 0,
        timeUsed:   0,
      });
    } catch {
      // Silently handle — will retry next app open
    }
  }

  useEffect(() => {
    checkAndReset();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndReset();
    });

    return () => sub.remove();
  }, []);
}
