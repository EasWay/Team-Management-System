import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/lib/constants';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Alert } from '@/components/CustomAlert';
import { useThemeStore } from '@/store/themeStore';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const isDark = useThemeStore(state => state.isDark);

  const handleGitHubOAuth = async () => {
    setLoading(true);
    try {
      const mobileRedirectUri = Linking.createURL('/oauth-callback');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE_URL}/api/oauth/github?mobile=true&mobile_redirect=${encodeURIComponent(mobileRedirectUri)}`,
        mobileRedirectUri
      );

      if (result.type === 'success') {
        const parsed = Linking.parse(result.url);
        const accessToken = parsed.queryParams?.accessToken as string | undefined;
        const refreshToken = parsed.queryParams?.refreshToken as string | undefined;

        if (!accessToken) throw new Error('No access token received');

        const userResp = await fetch(`${API_BASE_URL}/api/trpc/auth.me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userJson = await userResp.json();
        const userData = userJson?.result?.data?.json ?? userJson?.result?.data;

        await setAuth(
          {
            id: userData?.id ?? 0,
            email: userData?.email ?? '',
            name: userData?.name ?? userData?.email ?? 'User',
            avatarUrl: userData?.avatarUrl,
          },
          accessToken,
          refreshToken ?? ''
        );
        router.replace('/(app)');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OAuth failed';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-1 px-6 justify-center">
        {/* Header */}
        <View className="mb-12 items-center">
          <View className="w-20 h-20 rounded-3xl bg-sky-600 items-center justify-center mb-6"
            style={{ shadowColor: '#0ea5e9', shadowRadius: 20, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 6 } }}
          >
            <Ionicons name="people" size={36} color="white" />
          </View>
          <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Team Manager</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-base text-center">
            Sign in to collaborate with your team
          </Text>
        </View>

        {/* GitHub OAuth */}
        <TouchableOpacity
          onPress={handleGitHubOAuth}
          disabled={loading}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex-row items-center justify-center gap-3"
          style={{ minHeight: 56 }}
        >
          {loading ? (
            <ActivityIndicator color={isDark ? '#94a3b8' : '#64748b'} />
          ) : (
            <Ionicons name="logo-github" size={22} color={isDark ? 'white' : '#0f172a'} />
          )}
          <Text className="text-slate-850 dark:text-white font-semibold text-base">
            {loading ? 'Signing in…' : 'Continue with GitHub'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
