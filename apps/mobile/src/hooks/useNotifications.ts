import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { authService } from '../services/auth.service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener    = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // handled by the notification handler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Deep-link handling via notification data can be wired here
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
    // Non-fatal — push notifications optional
  }
}

export async function scheduleTimeWarningNotification(secondsRemaining: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Running Low on Time',
      body: `Only ${Math.floor(secondsRemaining / 60)} minutes of social media time left!`,
      data: { type: 'time_warning' },
    },
    trigger: null,
  });
}
