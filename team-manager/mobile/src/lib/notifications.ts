import { Platform } from 'react-native';
import { router } from 'expo-router';
import { SecureStorage } from './secureStorage';
import { STORAGE_KEYS, API_BASE_URL } from './constants';
import Constants from 'expo-constants';

// In Expo SDK 53, push notification functionality has been removed from Expo Go (specifically on Android,
// where it console.errors and causes a RedBox crash). We dynamically require 'expo-notifications'
// only when NOT running inside Expo Go, avoiding the auto-registration crash.
const isExpoGo = Constants.appOwnership === 'expo';
let Notifications: any = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[Notifications] Failed to require expo-notifications:', err);
  }
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) {
    console.log('[Notifications] Skipping permission request in Expo Go');
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerPushToken(): Promise<string | null> {
  if (!Notifications) {
    console.log('[Notifications] Skipping push token registration in Expo Go');
    return null;
  }
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#888888',
    });

    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Task Assignments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
    });

    await Notifications.setNotificationChannelAsync('approvals', {
      name: 'Approvals',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    await SecureStorage.set(STORAGE_KEYS.PUSH_TOKEN, pushToken);
    await syncTokenWithServer(pushToken);

    return pushToken;
  } catch (err) {
    console.warn('[Notifications] Could not get push token:', err);
    return null;
  }
}

async function syncTokenWithServer(pushToken: string): Promise<void> {
  const accessToken = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
  if (!accessToken) return;

  try {
    await fetch(`${API_BASE_URL}/api/trpc/notifications.registerPushToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ json: { pushToken } }),
    });
  } catch (err) {
    console.warn('[Notifications] Failed to sync push token:', err);
  }
}

export function handleNotificationNavigation(data: Record<string, unknown>) {
  switch (data.type) {
    case 'task_assigned':
      router.push(`/(app)/tasks?taskId=${data.taskId}`);
      break;
    case 'approval_requested':
      router.push(`/(app)/conference`);
      break;
    case 'mention':
      router.push(`/(app)/tasks?taskId=${data.taskId}`);
      break;
    case 'folder_handoff':
      router.push(`/(app)/projects?projectId=${data.projectId}`);
      break;
    case 'evaluation_complete':
      router.push(`/(app)/projects?projectId=${data.projectId}`);
      break;
    case 'calendar_reminder':
      router.push(`/(app)/calendar?eventId=${data.eventId}`);
      break;
    default:
      router.push('/(app)');
  }
}

export function setupNotificationResponseListener() {
  if (!Notifications) {
    console.log('[Notifications] Skipping response listener setup in Expo Go');
    return { remove: () => {} };
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    handleNotificationNavigation(data);
  });
  return subscription;
}

export async function setBadgeCount(count: number) {
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (err) {
    console.warn('[Notifications] Failed to set badge count:', err);
  }
}
