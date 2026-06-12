import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
// Type-only import — erased at build, so Metro never bundles the API server.
import type { AppRouter } from 'api/trpc';

/**
 * Typed tRPC + TanStack Query bindings.
 *
 * Inlined in the mobile app for now. When `apps/web` comes online this should
 * move to a shared `packages/api-client` exposing a `createApiClient` factory,
 * with each app supplying its own base URL + token source.
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

const url = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/trpc';

// Dev auth: the API's stub auth treats the bearer token *as* the userId
// (see apps/api/src/lib/auth.ts). Swap for a real JWT once auth ships.
const devUserId = process.env.EXPO_PUBLIC_DEV_USER_ID;

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url,
      headers() {
        return devUserId ? { authorization: `Bearer ${devUserId}` } : {};
      },
    }),
  ],
});
