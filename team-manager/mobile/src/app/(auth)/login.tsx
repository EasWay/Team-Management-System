import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const heroImage = require('../../../assets/background-removed (1).png');

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

  const fg = isDark ? '#FFFFFF' : '#0A0A0A';
  const subtitleColor = isDark ? '#888888' : '#6B6B6B';
  const bg = isDark ? '#000000' : '#FFFFFF';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' }}>

        {/* Hero illustration */}
        <Image
          source={heroImage}
          style={{
            width: SCREEN_WIDTH * 0.82,
            height: SCREEN_WIDTH * 0.74,
            resizeMode: 'contain',
            marginBottom: 36,
          }}
        />

        {/* Title */}
        <Text
          style={{
            fontSize: 38,
            fontWeight: '800',
            color: fg,
            letterSpacing: -1,
            alignSelf: 'flex-start',
            marginBottom: 12,
          }}
        >
          {'Welcome!'}
          <Text style={{ color: fg, opacity: 0.35 }}>{'.'}</Text>
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontSize: 15,
            color: subtitleColor,
            lineHeight: 22,
            alignSelf: 'flex-start',
            marginBottom: 44,
          }}
        >
          Sign in to collaborate, manage your projects, and build amazing things together.
        </Text>

        {/* Continue with GitHub — outlined pill button */}
        <TouchableOpacity
          onPress={handleGitHubOAuth}
          disabled={loading}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: fg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: loading ? 0.55 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <Ionicons name="logo-github" size={22} color={fg} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '600', color: fg }}>
            {loading ? 'Signing in…' : 'Continue with GitHub'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
