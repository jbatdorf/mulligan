import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useTRPC } from '@/lib/trpc';

export type SelectedCourse = { id: string; name: string };

type Props = {
  onPicked: (course: SelectedCourse) => void;
};

export function SearchStep({ onPicked }: Props) {
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Debounce keystrokes before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    trpc.course.search.queryOptions(
      { query: debounced },
      { enabled: debounced.length > 0 },
    ),
  );

  const pick = useMutation(
    trpc.course.getOrCreateFromPlace.mutationOptions({
      onSuccess: (course) => onPicked({ id: course.id, name: course.name }),
    }),
  );

  return (
    <View className="flex-1 gap-4">
      <Text className="text-2xl font-bold text-black dark:text-white">
        Which course did you play?
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search golf courses"
        placeholderTextColor="#9ca3af"
        autoFocus
        className="rounded-xl bg-neutral-100 px-4 py-3 text-base text-black dark:bg-neutral-900 dark:text-white"
      />

      {(results.isFetching || pick.isPending) && <ActivityIndicator />}

      <View className="gap-2">
        {results.data?.map((c) => (
          <Pressable
            key={c.googlePlaceId}
            disabled={pick.isPending}
            onPress={() => pick.mutate(c)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Text className="text-base font-medium text-black dark:text-white">{c.name}</Text>
            <Text className="text-sm text-neutral-500">{c.address}</Text>
          </Pressable>
        ))}
      </View>

      {debounced.length > 0 && results.isSuccess && results.data.length === 0 && (
        <Text className="text-neutral-500">No courses found.</Text>
      )}
    </View>
  );
}
