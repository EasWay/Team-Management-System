import '../global.css';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { trpc, buildTRPCClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { registerPushToken, setupNotificationResponseListener } from '@/lib/notifications';
import { getSocket } from '@/lib/socket';
import { CustomAlertProvider } from '@/components/CustomAlert';
import { useColorScheme } from 'nativewind';

// Keep native splash visible until auth + theme are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const CACHE_VERSION = 'v2'; // bump to bust persisted cache after breaking schema changes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Data is considered fresh for 5 min — no refetch while fresh
      staleTime: 1000 * 60 * 5,
      // Keep in memory (and persisted to disk) for 24 hours
      gcTime: 1000 * 60 * 60 * 24,
      // Don't hammer the server if it's offline; show cache instead
      networkMode: 'offlineFirst',
    },
  },
});

// Persist the React Query cache to AsyncStorage so it survives app restarts.
// On next launch, cached data is shown immediately while a background refresh runs.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: `rq-cache-${CACHE_VERSION}`,
  throttleTime: 2000, // write to storage at most every 2s
});

const trpcClient = buildTRPCClient();

export default function RootLayout() {
  useFonts({
    PlayfairDisplay_700Bold:    require('../../assets/fonts/PlayfairDisplay_700Bold.ttf'),
    PlayfairDisplay_400Regular: require('../../assets/fonts/PlayfairDisplay_400Regular.ttf'),
  });
  const { loadFromStorage, isAuthenticated } = useAuthStore();
  const { load: loadTheme, isDark } = useThemeStore();
  const { setColorScheme } = useColorScheme();
  const notifSubRef = useRef<ReturnType<typeof setupNotificationResponseListener> | null>(null);

  useEffect(() => {
    Promise.all([loadFromStorage(), loadTheme()])
      .finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, []);

  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // discard cache older than 24h
          buster: CACHE_VERSION,
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="oauth-callback" />
            </Stack>
            <CustomAlertProvider />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistQueryClientProvider>
    </trpc.Provider>
  );
}
