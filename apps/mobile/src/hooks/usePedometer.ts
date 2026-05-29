/**
 * usePedometer — step counting for iOS and Android
 *
 * iOS strategy (most accurate):
 *   1. requestPermissionsAsync() — CoreMotion requires explicit permission
 *   2. getStepCountAsync(startOfDay, now) — pulls accurate daily total from CMPedometer
 *   3. watchStepCount() — gets incremental updates; we add them to the midnight baseline
 *   4. On foreground resume: re-query midnight baseline so we stay accurate even if
 *      the subscription was paused while in background
 *
 * Android strategy:
 *   watchStepCount() gives steps accumulated since the subscription started.
 *   We store a "session base" (steps already synced today before this app session)
 *   so reopening the app doesn't reset the total.
 *   The server uses MAX(incoming, stored) so sending a lower count is always safe.
 *
 * Sync logic:
 *   - Sync whenever ≥ STEPS_SYNC_THRESHOLD new steps accumulated since last sync
 *   - Always sync when the app moves to background (flush partial progress)
 *   - On sync error: silently retry next threshold
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useTimeStore } from '../store/time.store';
import { activitiesService } from '../services/activities.service';

const STEPS_SYNC_THRESHOLD = 500;   // sync every 500 new steps

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function usePedometer() {
  const { updateSteps, addTime } = useTimeStore();

  // Running daily total sent to the store / server
  const dailyTotalRef   = useRef(0);
  // Daily total at the last successful server sync
  const lastSyncedRef   = useRef(0);
  // iOS: steps accumulated by watchStepCount since the last baseline query
  const watchDeltaRef   = useRef(0);
  // iOS: midnight-to-baseline query result (steps before current watch window)
  const midnightBaseRef = useRef(0);

  // ── Server sync ──────────────────────────────────────────────────────────────
  const syncToServer = useCallback(async (totalSteps: number) => {
    if (totalSteps <= lastSyncedRef.current) return;   // nothing new
    try {
      const res = await activitiesService.recordSteps(totalSteps);
      addTime(res.secondsAdded);
      lastSyncedRef.current = totalSteps;
    } catch {
      // Server will reconcile next time we sync successfully
    }
  }, [addTime]);

  // ── Update store + conditionally sync ────────────────────────────────────────
  const handleNewTotal = useCallback((total: number, force = false) => {
    dailyTotalRef.current = total;
    updateSteps(total);
    if (force || total - lastSyncedRef.current >= STEPS_SYNC_THRESHOLD) {
      syncToServer(total);
    }
  }, [updateSteps, syncToServer]);

  // ── iOS: re-query from midnight ───────────────────────────────────────────────
  // Called on mount and whenever the app returns to foreground.
  const refreshIosBaseline = useCallback(async () => {
    try {
      const { steps } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
      midnightBaseRef.current = steps;
      watchDeltaRef.current   = 0;   // reset delta; watch subscription will add fresh increments
      handleNewTotal(steps);
    } catch { /* CoreMotion unavailable on simulator */ }
  }, [handleNewTotal]);

  // ── Main effect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let dead = false;

    (async () => {
      // ── 1. Check availability ────────────────────────────────────────────────
      const available = await Pedometer.isAvailableAsync();
      if (!available || dead) return;

      // ── 2. Request permission (required on iOS; no-op on Android) ────────────
      const { granted } = await Pedometer.requestPermissionsAsync();
      if (!granted || dead) return;

      // ── 3. iOS: get accurate steps-since-midnight baseline ───────────────────
      if (Platform.OS === 'ios') {
        await refreshIosBaseline();
      }

      if (dead) return;

      // ── 4. Subscribe to live step updates ────────────────────────────────────
      subscription = Pedometer.watchStepCount((result) => {
        if (dead) return;

        if (Platform.OS === 'ios') {
          // result.steps = steps since THIS subscription started.
          // We add them on top of the midnight baseline captured above.
          watchDeltaRef.current = result.steps;
          handleNewTotal(midnightBaseRef.current + result.steps);
        } else {
          // Android: result.steps = cumulative from subscription start.
          // Works fine with the server's MAX() logic.
          handleNewTotal(result.steps);
        }
      });
    })();

    // ── 5. AppState: flush to server on background, refresh iOS on foreground ──
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        // Flush even partial progress so no steps are lost
        syncToServer(dailyTotalRef.current);
      } else if (state === 'active' && Platform.OS === 'ios') {
        // Re-query midnight baseline after returning from background
        // (CoreMotion continues counting steps even while app is paused)
        refreshIosBaseline();
      }
    };

    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      dead = true;
      subscription?.remove();
      appStateSub.remove();
      // Final flush on unmount
      syncToServer(dailyTotalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
