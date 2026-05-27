import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../server/routers';
import { API_BASE_URL } from './constants';
import { SecureStorage } from './secureStorage';
import { STORAGE_KEYS } from './constants';

export type { AppRouter };

export const trpc = createTRPCReact<AppRouter>();

export function buildTRPCClient() {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/api/trpc`,
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
