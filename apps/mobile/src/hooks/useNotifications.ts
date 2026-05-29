import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { authService } from '../services/auth.service';
import { useSettingsStore } from '../store/settings.store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener     = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Handled by the notification handler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      // Tapping any social-tracking notification just brings the app to the foreground.
      // The SocialAppsTracker's BlockedView shows inline when currentTime <= 0.
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

async function registerForPushNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Socialess',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await authService.updatePushToken(token);
  } catch {
    // Non-fatal — push notifications are optional
  }
}

/**
 * Schedule warning + time-up notifications for an active social media session.
 * Respects the user's notification preference from settings.
 * Cancels any previously scheduled notifications first.
 */
export async function scheduleSocialNotifications(
  budgetSeconds: number,
  appName: string,
): Promise<void> {
  const { notificationsEnabled } = useSettingsStore.getState();
  if (!notificationsEnabled) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (budgetSeconds <= 0) return;

  // 5-minute warning (only if budget > 5 min)
  if (budgetSeconds > 5 * 60) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ 5 Minutes Left',
        body: `Your time on ${appName} is almost up — wrap it up soon!`,
        data: { type: 'time_warning' },
      },
      trigger: { seconds: budgetSeconds - 5 * 60 } as any,
    });
  } else if (budgetSeconds > 60) {
    // Budget between 1–5 min: warn at the halfway point
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Almost Out of Time',
        body: `Only ${Math.ceil(budgetSeconds / 60)} min left on ${appName}!`,
        data: { type: 'time_warning' },
      },
      trigger: { seconds: Math.floor(budgetSeconds / 2) } as any,
    });
  }

  // Time-up notification with action prompt
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⛔ Time\'s Up!',
      body: `Your time on ${appName} has ended. Open Socialess and earn more time by working out!`,
      data: { type: 'time_up' },
      sound: true,
    },
    trigger: { seconds: budgetSeconds } as any,
  });
}
