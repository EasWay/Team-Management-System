import '../global.css';
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { trpc, buildTRPCClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { registerPushToken, setupNotificationResponseListener } from '@/lib/notifications';
import { getSocket } from '@/lib/socket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  },
});

const trpcClient = buildTRPCClient();

export default function RootLayout() {
  const { loadFromStorage, isAuthenticated } = useAuthStore();
  const { load: loadTheme } = useThemeStore();
  const notifSubRef = useRef<ReturnType<typeof setupNotificationResponseListener> | null>(null);

  useEffect(() => {
    loadFromStorage();
    loadTheme();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      getSocket().catch(console.warn);
      registerPushToken().catch(console.warn);
      notifSubRef.current = setupNotificationResponseListener();
    }
    return () => {
      notifSubRef.current?.remove();
    };
  }, [isAuthenticated]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              {/* OAuth deep-link callback — must be registered so expo-router doesn't 404 */}
              <Stack.Screen name="oauth-callback" />
            </Stack>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
