import { Platform } from 'react-native';
import { router } from 'expo-router';
import { SecureStorage } from './secureStorage';
import { STORAGE_KEYS, API_BASE_URL } from './constants';
import Constants from 'expo-constants';

// In Expo SDK 53+, push notification functionality is removed from Expo Go on Android.
// Dynamically require 'expo-notifications' only when NOT running in Expo Go.
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
  if (!Notifications) return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      description: 'General notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#888888',
    });
    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Task Assignments',
      description: 'Notifications for task assignments and deadlines',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
    });
    await Notifications.setNotificationChannelAsync('approvals', {
      name: 'Approvals',
      description: 'Stage gate approval requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
    });
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'Direct messages from team members',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
    });
    await Notifications.setNotificationChannelAsync('files', {
      name: 'Files',
      description: 'File uploads and folder activity',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
    });
    await Notifications.setNotificationChannelAsync('projects', {
      name: 'Projects',
      description: 'Project updates and milestones',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenData.data;
    await SecureStorage.set(STORAGE_KEYS.PUSH_TOKEN, pushToken);
    await syncTokenWithServer(pushToken);
    return pushToken;
  } catch (err) {
    console.warn('[Notifications] Could not get push token:', err);
    return null;
  }
}

export async function syncTokenWithServer(pushToken: string): Promise<void> {
  const accessToken = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
  if (!accessToken) {
    console.log('[Notifications] No access token found, skipping syncTokenWithServer');
    return;
  }
  try {
    console.log('[Notifications] Syncing push token with server...');
    const res = await fetch(`${API_BASE_URL}/api/trpc/registerPushToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ json: { pushToken, platform: Platform.OS } }),
    });
    console.log('[Notifications] Sync push token response status:', res.status);
    if (!res.ok) {
      console.warn('[Notifications] Failed to sync push token, server returned:', await res.text());
    }
  } catch (err) {
    console.warn('[Notifications] Network error syncing push token:', err);
  }
}

export function handleNotificationNavigation(data: Record<string, unknown>) {
  const type = data.type as string | undefined;
  switch (type) {
    case 'task_assignment':
    case 'task_assigned':
    case 'deadline_approaching':
    case 'mention':
      router.push(data.taskId ? `/(app)/tasks?taskId=${data.taskId}` : '/(app)/tasks');
      break;
    case 'approval_request':
    case 'approval_requested':
      router.push('/(app)/conference');
      break;
    case 'folder_alert':
    case 'folder_handoff':
    case 'file_uploaded':
      router.push('/(app)/files');
      break;
    case 'project_update':
    case 'evaluation_complete':
      router.push(data.projectId ? `/(app)/projects?projectId=${data.projectId}` : '/(app)/projects');
      break;
    case 'team_message':
    case 'message':
      router.push('/(app)/messages');
      break;
    case 'calendar_reminder':
      router.push('/(app)/calendar');
      break;
    default:
      router.push('/(app)');
  }
}

export function setupNotificationResponseListener() {
  if (!Notifications) return { remove: () => {} };
  const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    handleNotificationNavigation(data);
  });
  return subscription;
}

export function setupNotificationReceivedListener(onReceived: (notification: any) => void) {
  if (!Notifications) return { remove: () => {} };
  const subscription = Notifications.addNotificationReceivedListener(onReceived);
  return subscription;
}

export async function handleInitialNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data as Record<string, unknown>;
      setTimeout(() => handleNotificationNavigation(data), 500);
    }
  } catch (err) {
    console.warn('[Notifications] Failed to check initial notification:', err);
  }
}

export async function setBadgeCount(count: number) {
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (err) {
    console.warn('[Notifications] Failed to set badge count:', err);
  }
}
