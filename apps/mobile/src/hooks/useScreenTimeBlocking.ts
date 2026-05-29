/**
 * useScreenTimeBlocking
 *
 * Reactively applies / removes an iOS Screen Time block based on the
 * user's remaining social-media budget.
 *
 *   currentTime > 0  →  unblockApps()  (clear any active restriction)
 *   currentTime ≤ 0  →  blockApps()   (engage system-level shield)
 *
 * The shield is applied via ManagedSettingsStore (FamilyControls framework).
 * When the user opens a blocked app they see the iOS "Screen Time" lock screen
 * — they cannot bypass it without the Screen Time passcode.
 *
 * Requirements:
 *   • iOS 16+
 *   • Entitlement: com.apple.developer.family-controls
 *   • User has completed the one-time Screen Time setup in Settings
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTimeStore } from '../store/time.store';
import { useAuthStore } from '../store/auth.store';
import { ExpoScreenTime } from '../../modules/expo-screen-time/src';

export function useScreenTimeBlocking() {
  const currentTime    = useTimeStore((s) => s.currentTime);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Only relevant on iOS with an authenticated user
    if (Platform.OS !== 'ios') return;
    if (!isAuthenticated) return;

    try {
      if (currentTime <= 0) {
        // Time exhausted — engage the block.
        // Returns false + no-ops silently if not yet authorized or no selection.
        ExpoScreenTime.blockApps();
      } else {
        // Budget available — lift any existing restriction.
        ExpoScreenTime.unblockApps();
      }
    } catch {
      // Module unavailable (e.g. Expo Go) — silently skip.
    }
  }, [currentTime, isAuthenticated]);
}

// ── Exported helpers for the Settings screen ──────────────────────────────────

export async function requestScreenTimeAuthorization(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const status = await ExpoScreenTime.requestAuthorization();
    return status === 'approved';
  } catch {
    return false;
  }
}

export async function openScreenTimeAppPicker(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await ExpoScreenTime.presentAppPicker();
  } catch {
    return false;
  }
}

export function getScreenTimeStatus(): {
  authStatus: string;
  isBlocked: boolean;
  hasSelection: boolean;
} {
  if (Platform.OS !== 'ios') {
    return { authStatus: 'unsupported', isBlocked: false, hasSelection: false };
  }
  try {
    return {
      authStatus:   ExpoScreenTime.getAuthorizationStatus(),
      isBlocked:    ExpoScreenTime.isBlocked(),
      hasSelection: ExpoScreenTime.hasSelection(),
    };
  } catch {
    return { authStatus: 'unsupported', isBlocked: false, hasSelection: false };
  }
}
