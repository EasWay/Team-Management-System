import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL, OAUTH_REDIRECT_URI } from '@/lib/constants';
import { Button } from '@/components/Button';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? 'auth.login' : 'auth.register';
      const resp = await fetch(`${API_BASE_URL}/api/trpc/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { email: email.trim(), password } }),
      });
      const json = await resp.json();
      const data = json?.result?.data?.json ?? json?.result?.data;
      if (!data?.accessToken) throw new Error(data?.message ?? 'Authentication failed');
      const user = {
        id: data.user?.id ?? data.userId,
        email: data.user?.email ?? email,
        name: data.user?.name ?? data.user?.email ?? email,
        avatarUrl: data.user?.avatarUrl,
      };
      await setAuth(user, data.accessToken, data.refreshToken ?? '');
      router.replace('/(app)/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubOAuth = async () => {
    setOauthLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE_URL}/api/oauth/github?mobile=true&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`,
        OAUTH_REDIRECT_URI
      );

      if (result.type === 'success') {
        const parsed = Linking.parse(result.url);
        const accessToken = parsed.queryParams?.accessToken as string | undefined;
        const refreshToken = parsed.queryParams?.refreshToken as string | undefined;

        if (!accessToken) throw new Error('No access token received');

        // Fetch user from backend using the token
        const userResp = await fetch(`${API_BASE_URL}/api/trpc/auth.me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userJson = await userResp.json();
        const userData = userJson?.result?.data?.json ?? userJson?.result?.data;

        const user = {
          id: userData?.id ?? 0,
          email: userData?.email ?? '',
          name: userData?.name ?? userData?.email ?? 'User',
          avatarUrl: userData?.avatarUrl,
        };

        await setAuth(user, accessToken, refreshToken ?? '');
        router.replace('/(app)/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OAuth failed';
      Alert.alert('OAuth Error', msg);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 justify-center py-12">
            {/* Header */}
            <View className="mb-10">
              <Text className="text-4xl font-bold text-white mb-2">Team Manager</Text>
              <Text className="text-slate-400 text-base">
                {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
              </Text>
            </View>

            {/* GitHub OAuth */}
            <TouchableOpacity
              onPress={handleGitHubOAuth}
              disabled={oauthLoading}
              className="bg-slate-800 border border-slate-600 rounded-xl p-4 flex-row items-center justify-center gap-3 mb-6"
            >
              {oauthLoading ? (
                <ActivityIndicator color="#94a3b8" />
              ) : (
                <Text className="text-2xl">🐙</Text>
              )}
              <Text className="text-white font-semibold text-base">
                {oauthLoading ? 'Signing in...' : 'Continue with GitHub'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 px-4 text-sm">or use email</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-slate-400 text-sm mb-2 font-medium">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>

            {/* Password */}
            <View className="mb-6">
              <Text className="text-slate-400 text-sm mb-2 font-medium">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#475569"
                secureTextEntry
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>

            {/* Submit */}
            <Button
              label={mode === 'login' ? 'Sign In' : 'Create Account'}
              onPress={handleEmailAuth}
              loading={loading}
              fullWidth
            />

            {/* Mode toggle */}
            <TouchableOpacity
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="mt-6 items-center"
            >
              <Text className="text-slate-400 text-sm">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text className="text-sky-400 font-semibold">
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
