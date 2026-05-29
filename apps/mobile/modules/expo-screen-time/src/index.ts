import { requireOptionalNativeModule } from 'expo-modules-core';

export type AuthorizationStatus = 'approved' | 'denied' | 'notDetermined' | 'unsupported';

interface ExpoScreenTimeInterface {
  /** Show the iOS system dialog requesting Screen Time permission. */
  requestAuthorization(): Promise<AuthorizationStatus>;
  /** Returns the current authorization status without showing any dialog. */
  getAuthorizationStatus(): AuthorizationStatus;
  /**
   * Present the system FamilyActivityPicker so the user can select which apps
   * to block. Resolves true if Done was tapped, false if cancelled.
   */
  presentAppPicker(): Promise<boolean>;
  /**
   * Apply system-level blocks on the previously selected apps.
   * Returns false if no selection has been saved yet.
   */
  blockApps(): boolean;
  /** Remove all Screen Time restrictions applied by this app. */
  unblockApps(): void;
  /** Returns true if apps are currently blocked. */
  isBlocked(): boolean;
  /** Returns true if the user has previously made an app selection. */
  hasSelection(): boolean;
}

// Stub used in Expo Go / Android / simulator — all calls silently no-op.
const stub: ExpoScreenTimeInterface = {
  requestAuthorization: async () => 'unsupported',
  getAuthorizationStatus: () => 'unsupported',
  presentAppPicker: async () => false,
  blockApps: () => false,
  unblockApps: () => {},
  isBlocked: () => false,
  hasSelection: () => false,
};

// requireOptionalNativeModule returns null when the native module isn't linked
// (Expo Go, Android, simulator without a custom build) — never throws.
export const ExpoScreenTime: ExpoScreenTimeInterface =
  requireOptionalNativeModule<ExpoScreenTimeInterface>('ExpoScreenTime') ?? stub;
