import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { API_BASE_URL } from './constants';
import { SecureStorage } from './secureStorage';
import { STORAGE_KEYS } from './constants';

// Attempt to import the real AppRouter, fallback to any if missing
// This allows the app to compile even if the server directory is not present
type MockRouter = any;
export type { MockRouter as AppRouter };

export const trpc: any = createTRPCReact<any>();

export function buildTRPCClient() {
  // In tRPC v11, the transformer must be on the link, NOT on createClient.
  // Having it on createClient is silently ignored, which means the server's
  // superjson-encoded responses are never decoded → data arrives as
  // {json: [...], meta: {}} instead of a plain array → FlatList renders nothing.
  return (trpc as any).createClient({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
      }),
    ],
  });
}
