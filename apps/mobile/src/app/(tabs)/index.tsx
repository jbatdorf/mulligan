import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';

export default function HomeScreen() {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(trpc.user.me.queryOptions());

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 gap-3 px-6 pt-4">
        <Text className="text-3xl font-bold text-black dark:text-white">mulligan</Text>

        {isLoading && <ActivityIndicator />}

        {error && (
          <Text className="text-red-500">Couldn&apos;t reach the API: {error.message}</Text>
        )}

        {data && (
          <Text className="text-base text-neutral-500">Signed in as {data.name}</Text>
        )}

        <View className="flex-1 items-center justify-center">
          <Text className="mb-6 text-center text-neutral-500">
            Your activity feed will live here.
          </Text>
        </View>

        <View className="pb-2">
          <Button label="＋  Log a round" onPress={() => router.push('/rate')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
