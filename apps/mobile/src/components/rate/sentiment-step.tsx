import { useMutation } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { useTRPC } from '@/lib/trpc';
import type { SelectedCourse } from './search-step';

// Mirror of the API's RatingStepResult discriminated union.
export type RatingStepResult =
  | { done: false; sessionId: string; courseId: string; pivotCourseId: string }
  | { done: true; courseId: string; score: number; rank: number; total: number };

type Sentiment = 'disliked' | 'fine' | 'liked';

const OPTIONS: { value: Sentiment; label: string; emoji: string; tint: string }[] = [
  { value: 'disliked', label: "Didn't like it", emoji: '👎', tint: 'bg-red-100 dark:bg-red-950' },
  { value: 'fine', label: 'It was fine', emoji: '😐', tint: 'bg-yellow-100 dark:bg-yellow-950' },
  { value: 'liked', label: 'Loved it', emoji: '🔥', tint: 'bg-green-100 dark:bg-green-950' },
];

type Props = {
  course: SelectedCourse;
  onResult: (result: RatingStepResult) => void;
};

export function SentimentStep({ course, onResult }: Props) {
  const trpc = useTRPC();
  const start = useMutation(
    trpc.rating.start.mutationOptions({
      onSuccess: (res) => onResult(res as RatingStepResult),
    }),
  );

  return (
    <View className="flex-1 gap-4">
      <Text className="text-2xl font-bold text-black dark:text-white">{course.name}</Text>
      <Text className="text-base text-neutral-500">What did you think?</Text>

      <View className="gap-3">
        {OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            disabled={start.isPending}
            onPress={() => start.mutate({ courseId: course.id, initialSentiment: o.value })}
            style={({ pressed }) => ({ opacity: start.isPending ? 0.5 : pressed ? 0.8 : 1 })}
            className={`flex-row items-center gap-3 rounded-2xl px-5 py-4 ${o.tint}`}>
            <Text className="text-2xl">{o.emoji}</Text>
            <Text className="text-lg font-semibold text-black dark:text-white">{o.label}</Text>
          </Pressable>
        ))}
      </View>

      {start.isError && (
        <Text className="text-red-500">{start.error.message}</Text>
      )}
    </View>
  );
}
