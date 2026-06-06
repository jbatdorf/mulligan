import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTRPC } from '@/lib/trpc';

/**
 * Foundation smoke screen.
 *
 * Proves the full pipeline end-to-end: tRPC client → auth header → TanStack
 * Query → NativeWind styling. `user.me` is used because it only needs
 * `ctx.userId` and has no dependency on seeded follows/posts.
 */
export default function HomeScreen() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.user.me.queryOptions());

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-2xl font-bold text-black dark:text-white">
          mulligan
        </Text>

        {isLoading && <ActivityIndicator />}

        {error && (
          <Text className="text-center text-red-500">
            Couldn&apos;t reach the API: {error.message}
          </Text>
        )}

        {data && (
          <View className="items-center gap-1">
            <Text className="text-lg text-black dark:text-white">
              Signed in as {data.name}
            </Text>
            <Text className="text-xs text-neutral-500">{data.id}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
