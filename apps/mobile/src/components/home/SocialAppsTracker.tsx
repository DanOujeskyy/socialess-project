/**
 * SocialAppsTracker
 *
 * Opens social-media sites inside an in-app WebBrowser (SFSafariViewController on iOS).
 * Because the session stays inside our app we have full control:
 *   • When the user's budget hits 0 we call WebBrowser.dismissBrowser() — the browser
 *     closes immediately and they land back in Socialess with no time left.
 *   • When they close the browser manually we deduct the elapsed time and sync to server.
 *
 * Native-app opens (user goes directly to Instagram from the home screen) are handled
 * separately by the passive AppState tracker in useSocialTracking.
 *
 * UI states:
 *   1. blocked  — currentTime ≤ 0, shows earn-time UI
 *   2. opening  — brief loading state before browser appears
 *   3. idle     — normal app-icon grid
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import {
  SOCIAL_APPS_CONFIG,
  SOCIAL_APP_WEB_URLS,
} from '../../constants';
import { useTimeStore } from '../../store/time.store';
import { useSettingsStore } from '../../store/settings.store';
import { scheduleSocialNotifications } from '../../hooks/useNotifications';
import { activitiesService } from '../../services/activities.service';
import type { SocialApp } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── BlockedView ──────────────────────────────────────────────────────────────

function BlockedView() {
  return (
    <View style={styles.blockedCard}>
      <Text style={styles.blockedIcon}>⛔</Text>
      <Text style={styles.blockedTitle}>Time's Up</Text>
      <Text style={styles.blockedSub}>
        Earn more time by working out and come back
      </Text>
      <View style={styles.earnRow}>
        <TouchableOpacity
          style={styles.earnBtn}
          activeOpacity={0.8}
          onPress={() =>
            router.push({ pathname: '/(app)/exercise', params: { type: 'clicks' } })
          }
        >
          <Text style={styles.earnBtnEmoji}>🤸</Text>
          <Text style={styles.earnBtnLabel}>Push ups</Text>
          <Text style={styles.earnBtnRate}>+15s / rep</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.earnBtn}
          activeOpacity={0.8}
          onPress={() =>
            router.push({ pathname: '/(app)/exercise', params: { type: 'squats' } })
          }
        >
          <Text style={styles.earnBtnEmoji}>🏋️</Text>
          <Text style={styles.earnBtnLabel}>Squats</Text>
          <Text style={styles.earnBtnRate}>+10s / rep</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SocialAppsTracker() {
  const {
    isSocialActive,
    socialStartTime,
    currentTime,
    startSocialUsage,
    stopSocialUsage,
    consumeTime,
  } = useTimeStore();

  const trackedApps = useSettingsStore((s) => s.trackedApps);

  const visibleApps = (
    Object.entries(SOCIAL_APPS_CONFIG) as [SocialApp, { name: string; color: string }][]
  ).filter(([key]) => trackedApps[key]);

  // Local countdown — used only to detect when to force-close the browser
  const [displayRemaining, setDisplayRemaining] = useState(currentTime);
  const openingRef = useRef(false);

  // ── Live countdown while a session is active ──────────────────────────────
  useEffect(() => {
    if (!isSocialActive || !socialStartTime) {
      setDisplayRemaining(currentTime);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - socialStartTime) / 1000;
      setDisplayRemaining(Math.max(0, currentTime - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isSocialActive, socialStartTime, currentTime]);

  // ── Force-close the browser the instant time hits 0 ──────────────────────
  useEffect(() => {
    if (!isSocialActive || displayRemaining > 0) return;
    WebBrowser.dismissBrowser();
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }, [displayRemaining, isSocialActive]);

  // ── Open handler ──────────────────────────────────────────────────────────
  const handleOpen = useCallback(
    async (app: SocialApp) => {
      if (currentTime <= 0)               return;
      if (isSocialActive)                 return;
      if (openingRef.current)             return;
      if (!trackedApps[app])              return;

      openingRef.current = true;
      startSocialUsage(app);

      try {
        // Schedule budget-warning notifications (fire-and-forget — don't block browser open)
        scheduleSocialNotifications(currentTime, SOCIAL_APPS_CONFIG[app].name).catch(() => {});

        // Open the web version inside our app — this call blocks until
        // the user closes the sheet OR we call dismissBrowser() above.
        await WebBrowser.openBrowserAsync(SOCIAL_APP_WEB_URLS[app], {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          dismissButtonStyle: 'close',
          toolbarColor: '#0F172A',
          controlsColor: Colors.primary,
          enableBarCollapsing: true,
        });
      } catch {
        // Browser failed to open — clean up below
      } finally {
        // stopSocialUsage() returns the elapsed seconds AND clears isSocialActive
        const elapsed = stopSocialUsage();

        if (elapsed > 0) {
          consumeTime(elapsed);   // store floors at 0 automatically

          // Sync authoritative time from server
          try {
            const result = await activitiesService.logSocialMediaUsage(app, elapsed);
            useTimeStore.getState().setCurrentTime(result.currentTime);
          } catch {
            // Server unreachable — local deduction already applied
          }
        }

        Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
        openingRef.current = false;
      }
    },
    [currentTime, isSocialActive, trackedApps, startSocialUsage, stopSocialUsage, consumeTime],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // 1. Budget exhausted
  if (currentTime <= 0 && !isSocialActive) {
    return <BlockedView />;
  }

  // 2. No tracked apps configured
  if (visibleApps.length === 0) {
    return (
      <View style={styles.noAppsCard}>
        <Text style={styles.noAppsText}>
          No tracked apps configured.{' '}
          <Text
            style={styles.noAppsLink}
            onPress={() => router.push('/(app)/settings')}
          >
            Set up in Settings
          </Text>
        </Text>
      </View>
    );
  }

  // 3. Idle — show app grid with remaining budget
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Open Social App</Text>
        <Text style={[styles.budget, currentTime < 5 * 60 && styles.budgetLow]}>
          {formatTime(currentTime)} left
        </Text>
      </View>

      <View style={styles.appGrid}>
        {visibleApps.map(([key, cfg]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.appBtn,
              { borderColor: cfg.color + '44' },
              openingRef.current && styles.appBtnDisabled,
            ]}
            onPress={() => handleOpen(key)}
            activeOpacity={0.75}
            disabled={openingRef.current}
          >
            <View style={[styles.appDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.appName}>{cfg.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Idle ─────────────────────────────────────────────────────────────────
  container: { gap: Spacing.xs },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  heading: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budget: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  budgetLow: { color: Colors.danger },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  appBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    gap: 6,
  },
  appBtnDisabled: { opacity: 0.45 },
  appDot:  { width: 8, height: 8, borderRadius: 4 },
  appName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // ── Blocked ───────────────────────────────────────────────────────────────
  blockedCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    gap: Spacing.sm,
  },
  blockedIcon:  { fontSize: 32 },
  blockedTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  blockedSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  earnRow:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  earnBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  earnBtnEmoji: { fontSize: 24 },
  earnBtnLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  earnBtnRate: {
    fontSize: FontSize.xs,
    color: Colors.success,
  },

  // ── No apps ───────────────────────────────────────────────────────────────
  noAppsCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noAppsText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  noAppsLink: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
