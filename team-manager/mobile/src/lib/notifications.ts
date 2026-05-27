import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { SecureStorage } from './secureStorage';
import { STORAGE_KEYS, API_BASE_URL } from './constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
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
      router.push('/(app)/');
  }
}

export function setupNotificationResponseListener() {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    handleNotificationNavigation(data);
  });
  return subscription;
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
