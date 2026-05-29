import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { API_BASE_URL } from '@/lib/constants';

/**
 * Handles the OAuth deep-link redirect after GitHub login.
 * URL shape:  exp://<host>/--/oauth-callback?accessToken=...&refreshToken=...
 * expo-router maps the path segment to this file.
 */
export default function OAuthCallbackScreen() {
  const params = useLocalSearchParams<{
    accessToken?: string | string[];
    refreshToken?: string | string[];
    connected?: string | string[];
    error?: string | string[];
  }>();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const isDark = useThemeStore(state => state.isDark);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // expo-router can return arrays when a param appears multiple times
    const accessToken = Array.isArray(params.accessToken)
      ? params.accessToken[0]
      : params.accessToken;
    const refreshToken = Array.isArray(params.refreshToken)
      ? params.refreshToken[0]
      : params.refreshToken;
    const error = Array.isArray(params.error) ? params.error[0] : params.error;

    async function finish() {
      const connected = Array.isArray(params.connected) ? params.connected[0] : params.connected;

      // Google Drive connect flow — just navigate back to profile
      if (connected === 'google') {
        router.replace('/(app)/profile');
        return;
      }

      if (error || !accessToken) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/trpc/auth.me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await resp.json();
        const data = json?.result?.data?.json ?? json?.result?.data;

        await setAuth(
          {
            id: data?.id ?? 0,
            email: data?.email ?? '',
            name: data?.name ?? data?.email ?? 'User',
            avatarUrl: data?.avatarUrl,
          },
          accessToken,
          refreshToken ?? '',
        );
        router.replace('/(app)');
      } catch {
        router.replace('/(auth)/login');
      }
    }

    finish();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#0a0f1e' : '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <ActivityIndicator size="large" color="#38bdf8" />
      <Text style={{ color: isDark ? '#475569' : '#64748b', fontSize: 14, fontWeight: '500' }}>
        Signing you in…
      </Text>
    </View>
  );
}
