/**
 * useSocialTracking — Passive background-time tracking
 *
 * Concept: any time the app is in the background counts as social media time.
 * The user does not need to "open" a social app through Socialess — the moment
 * they leave our app, the clock starts.
 *
 * Why passive tracking instead of manual deeplink-based sessions:
 *   - The old manual approach required Linking.canOpenURL / Linking.openURL.
 *     On iOS these calls emit brief 'inactive' → 'active' AppState transitions
 *     (system dialogs, permission prompts) BEFORE the app actually goes to
 *     background. Every fix that tried to distinguish real vs. fake transitions
 *     had edge cases. Passive tracking sidesteps all of this.
 *   - 'background' is only emitted when the app truly moves to background.
 *     No Linking calls, no false triggers possible.
 *
 * Flow:
 *   app → background  →  record start time, schedule "time's up" notification
 *   app → active      →  compute elapsed, deduct from budget, cancel notification
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTimeStore } from '../store/time.store';
import { activitiesService } from '../services/activities.service';
import { scheduleSocialNotifications } from './useNotifications';

export function useSocialTracking() {
  const storeRef         = useRef(useTimeStore.getState());
  const bgStartRef       = useRef<number | null>(null);

  useEffect(() => {
    const unsub = useTimeStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  // ── App went to background ─────────────────────────────────────────────────
  const handleBackground = useCallback(() => {
    const { currentTime, isSocialActive } = storeRef.current;

    // Already counting — avoid double-starting
    if (isSocialActive) return;

    bgStartRef.current = Date.now();
    storeRef.current.startSocialUsage('session');

    // Only schedule time-countdown notifications when there is budget left
    if (currentTime > 0) {
      scheduleSocialNotifications(currentTime, 'social media').catch(() => {});
    }
  }, []);

  // ── App returned to foreground ─────────────────────────────────────────────
  const handleForeground = useCallback(async () => {
    const start = bgStartRef.current;
    if (start === null) return;

    const elapsed = Math.floor((Date.now() - start) / 1000);
    bgStartRef.current = null;

    // Capture store actions before any awaits (they are stable Zustand refs)
    const { currentTime, stopSocialUsage, consumeTime, setCurrentTime } = storeRef.current;

    // Stop the session — clears isSocialActive
    stopSocialUsage();

    // Deduct elapsed time from budget (capped so we never go below 0 instantly)
    if (elapsed > 0 && currentTime > 0) {
      consumeTime(Math.min(elapsed, currentTime));
    }

    // Cancel scheduled notifications (session is over)
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

    // Sync to server in the background — server returns authoritative remaining time
    if (elapsed > 0) {
      try {
        const result = await activitiesService.logSocialMediaUsage('session', elapsed);
        // Override local state with server truth (accounts for card effects etc.)
        storeRef.current.setCurrentTime(result.currentTime);
      } catch {
        // Server unreachable — local deduction already applied, daily reset reconciles
      }
    }
  }, []);

  // ── AppState listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') handleBackground();
      if (state === 'active')     handleForeground();
    });
    return () => sub.remove();
  }, [handleBackground, handleForeground]);
}
