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

const COLORS = {
  bg: '#020617',
  surface: '#0f172a',
  card: '#1e293b',
  border: 'rgba(51,65,85,0.8)',
  primary: '#0ea5e9',
  text: '#f8fafc',
  muted: '#94a3b8',
  subtle: '#334155',
};

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
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

  const inputStyle = (field: string) => ({
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: focusedField === field ? COLORS.primary : COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 48 }}>

            {/* Logo mark */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: '#0369a1',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  shadowColor: '#0ea5e9',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <Text style={{ fontSize: 32 }}>⚡</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 }}>
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.muted, marginTop: 6 }}>
                {mode === 'login' ? 'Sign in to your workspace' : 'Join your team on TeamOS'}
              </Text>
            </View>

            {/* GitHub OAuth */}
            <TouchableOpacity
              onPress={handleGitHubOAuth}
              disabled={oauthLoading}
              style={{
                backgroundColor: COLORS.card,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 24,
                minHeight: 52,
                opacity: oauthLoading ? 0.7 : 1,
              }}
            >
              {oauthLoading ? (
                <ActivityIndicator color={COLORS.muted} />
              ) : (
                <Text style={{ fontSize: 20 }}>🐙</Text>
              )}
              <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 16 }}>
                {oauthLoading ? 'Signing in...' : 'Continue with GitHub'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.subtle }} />
              <Text style={{ color: COLORS.muted, paddingHorizontal: 16, fontSize: 13 }}>or continue with email</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.subtle }} />
            </View>

            {/* Email field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('email')}
              />
            </View>

            {/* Password field */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.subtle}
                secureTextEntry
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('password')}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleEmailAuth}
              disabled={loading}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                minHeight: 52,
                opacity: loading ? 0.7 : 1,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              {loading && <ActivityIndicator color="white" size="small" />}
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {/* Mode toggle */}
            <TouchableOpacity
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={{ marginTop: 24, alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: COLORS.muted, fontSize: 14 }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
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
