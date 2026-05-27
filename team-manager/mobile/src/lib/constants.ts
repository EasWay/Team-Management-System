import Constants from 'expo-constants';

const ENV = Constants.expoConfig?.extra ?? {};

export const API_BASE_URL =
  (ENV.apiBaseUrl as string) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://team-management-system-zq6x.onrender.com';

export const WS_URL =
  (ENV.wsUrl as string) ||
  process.env.EXPO_PUBLIC_WS_URL ||
  'wss://team-management-system-zq6x.onrender.com';

export const APP_SCHEME = 'team-management';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PUSH_TOKEN: 'push_token',
} as const;

export const QUERY_KEYS = {
  TASKS: 'tasks',
  TEAMS: 'teams',
  PROJECTS: 'projects',
  FILES: 'files',
  FOLDERS: 'folders',
  CALENDAR: 'calendar',
  ANALYTICS: 'analytics',
  NOTIFICATIONS: 'notifications',
  APPROVALS: 'approvals',
} as const;
