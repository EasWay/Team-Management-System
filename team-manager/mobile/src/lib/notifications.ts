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
    console.log('[Notifications] Attempting to require expo-notifications (not in Expo Go)');
    Notifications = require('expo-notifications');
    console.log('[Notifications] expo-notifications loaded successfully');
  } catch (err) {
    console.error('[Notifications] Failed to require expo-notifications:', err);
  }
} else {
  console.log('[Notifications] Running in Expo Go, skipping expo-notifications require');
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
  console.log('[Notifications] Requesting notification permission...');
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available, cannot request permissions');
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Notifications] Existing permission status:', existingStatus);
  if (existingStatus === 'granted') {
    console.log('[Notifications] Permission already granted');
    return true;
  }
  console.log('[Notifications] Asking user for permissions...');
  const { status } = await Notifications.requestPermissionsAsync();
  console.log('[Notifications] New permission status after request:', status);
  return status === 'granted';
}

export async function registerPushToken(): Promise<string | null> {
  console.log('[Notifications] Starting registerPushToken() process...');
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available, skipping token registration');
    return null;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.warn('[Notifications] Notification permission not granted, cannot register push token');
    return null;
  }
  console.log('[Notifications] Permission verified, proceeding to set up channels (if Android) and fetch token');

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
    console.log('[Notifications] Fetching push token for projectId:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenData.data;
    console.log('[Notifications] Successfully fetched Expo Push Token:', pushToken);
    
    await SecureStorage.set(STORAGE_KEYS.PUSH_TOKEN, pushToken);
    console.log('[Notifications] Push token saved to SecureStorage successfully');
    
    await syncTokenWithServer(pushToken);
    return pushToken;
  } catch (err) {
    console.error('[Notifications] Could not get push token. Error details:', err);
    return null;
  }
}

export async function syncTokenWithServer(pushToken: string): Promise<void> {
  console.log('[Notifications] syncTokenWithServer() called with token:', pushToken);
  const accessToken = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
  if (!accessToken) {
    console.warn('[Notifications] No access token found, skipping syncTokenWithServer');
    return;
  }
  try {
    console.log('[Notifications] Syncing push token with server (API request)...');
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
      console.error('[Notifications] Failed to sync push token, server returned:', await res.text());
    } else {
      console.log('[Notifications] Push token successfully synced with server!');
    }
  } catch (err) {
    console.error('[Notifications] Network error syncing push token:', err);
  }
}

export function handleNotificationNavigation(data: Record<string, unknown>) {
  const type = data.type as string | undefined;
  const actionUrl = data.actionUrl as string | undefined;
  
  console.log('[Notifications] Routing with type:', type, 'actionUrl:', actionUrl);

  // 1. If we have an actionUrl from the backend, map it to our mobile routes
  if (actionUrl) {
    if (actionUrl.includes('/chat') || actionUrl.includes('/messages')) {
      router.push('/(app)/messages' as any);
      return;
    }
    if (actionUrl.includes('/tasks')) {
      router.push(data.taskId ? `/(app)/tasks?taskId=${data.taskId}` : '/(app)/tasks' as any);
      return;
    }
    if (actionUrl.includes('/projects')) {
      router.push(data.projectId ? `/(app)/projects?projectId=${data.projectId}` : '/(app)/projects' as any);
      return;
    }
    if (actionUrl.includes('/files') || actionUrl.includes('/drive')) {
      router.push('/(app)/files' as any);
      return;
    }
    if (actionUrl.includes('/teams')) {
      router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } });
      return;
    }
    if (actionUrl.includes('/calendar')) {
      router.push('/(app)/calendar' as any);
      return;
    }
  }

  // 2. Fallback routing based on type if actionUrl didn't match
  switch (type) {
    case 'task_assignment':
    case 'task_assigned':
    case 'deadline_approaching':
      router.push(data.taskId ? `/(app)/tasks?taskId=${data.taskId}` : '/(app)/tasks' as any);
      break;
    case 'approval_request':
    case 'approval_requested':
      router.push('/(app)/conference' as any);
      break;
    case 'folder_alert':
    case 'folder_handoff':
    case 'file_uploaded':
      router.push('/(app)/files' as any);
      break;
    case 'project_update':
    case 'evaluation_complete':
      router.push(data.projectId ? `/(app)/projects?projectId=${data.projectId}` : '/(app)/projects' as any);
      break;
    case 'team_message':
    case 'message':
    case 'mention': // Used for direct chat messages in db.ts
      router.push('/(app)/messages' as any);
      break;
    case 'calendar_reminder':
      router.push('/(app)/calendar' as any);
      break;
    default:
      router.push('/(app)' as any);
  }
}

export function setupNotificationResponseListener() {
  console.log('[Notifications] setupNotificationResponseListener() called');
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available, cannot setup response listener');
    return { remove: () => {} };
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
    console.log('[Notifications] Notification response received!', response);
    const data = response.notification.request.content.data as Record<string, unknown>;
    console.log('[Notifications] Navigating based on notification data:', data);
    handleNotificationNavigation(data);
  });
  console.log('[Notifications] Response listener setup successfully');
  return subscription;
}

export function setupNotificationReceivedListener(onReceived: (notification: any) => void) {
  console.log('[Notifications] setupNotificationReceivedListener() called');
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available, cannot setup received listener');
    return { remove: () => {} };
  }
  const subscription = Notifications.addNotificationReceivedListener((notification: any) => {
    console.log('[Notifications] Foreground notification received!', notification);
    onReceived(notification);
  });
  console.log('[Notifications] Received listener setup successfully');
  return subscription;
}

export async function handleInitialNotification(): Promise<void> {
  console.log('[Notifications] handleInitialNotification() called');
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available, skipping initial notification check');
    return;
  }
  try {
    console.log('[Notifications] Checking for initial notification response...');
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      console.log('[Notifications] Found initial notification response:', response);
      const data = response.notification.request.content.data as Record<string, unknown>;
      console.log('[Notifications] Scheduling navigation from initial notification data:', data);
      setTimeout(() => handleNotificationNavigation(data), 500);
    } else {
      console.log('[Notifications] No initial notification response found');
    }
  } catch (err) {
    console.error('[Notifications] Failed to check initial notification:', err);
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
