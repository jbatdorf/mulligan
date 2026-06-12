import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTRPC } from '@/lib/trpc';
import type { SelectedCourse } from './search-step';

const CAP = 5; // matches rating-engine CAP

type Props = {
  course: SelectedCourse;
  sessionId: string;
  firstPivotCourseId: string;
  onDone: (result: { score: number; rank: number }) => void;
};

export function CompareStep({ course, sessionId, firstPivotCourseId, onDone }: Props) {
  const trpc = useTRPC();
  const [pivotCourseId, setPivotCourseId] = useState(firstPivotCourseId);
  const [count, setCount] = useState(1);

  const pivot = useQuery(trpc.course.get.queryOptions({ courseId: pivotCourseId }));

  const submit = useMutation(
    trpc.rating.submitComparison.mutationOptions({
      onSuccess: (res) => {
        if (res.done) {
          onDone({ score: res.score, rank: res.rank });
        } else {
          setPivotCourseId(res.pivotCourseId);
          setCount((c) => c + 1);
        }
      },
    }),
  );

  const busy = submit.isPending || pivot.isLoading;

  const choose = (winnerCourseId: string | null, loserCourseId: string | null, tied: boolean) =>
    submit.mutate({ sessionId, winnerCourseId, loserCourseId, tied });

  return (
    <View className="flex-1 gap-5">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-black dark:text-white">
          Which did you like more?
        </Text>
        <Text className="text-sm text-neutral-500">Comparison {count} of up to {CAP}</Text>
      </View>

      <View className="gap-3">
        <ChoiceButton
          label={course.name}
          disabled={busy}
          onPress={() => choose(course.id, pivotCourseId, false)}
        />
        <ChoiceButton
          label={pivot.data?.name ?? '…'}
          disabled={busy || !pivot.data}
          onPress={() => choose(pivotCourseId, course.id, false)}
        />
      </View>

      <Pressable
        disabled={busy}
        onPress={() => choose(null, null, true)}
        style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.7 : 1 })}
        className="items-center py-2">
        <Text className="text-base font-medium text-neutral-500">Too close to call</Text>
      </Pressable>

      {busy && <ActivityIndicator />}

      {submit.isError && <Text className="text-center text-red-500">{submit.error.message}</Text>}
    </View>
  );
}

function ChoiceButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.6 : pressed ? 0.85 : 1 })}
      className="items-center justify-center rounded-2xl border-2 border-green-600 px-5 py-6">
      <Text className="text-lg font-semibold text-black dark:text-white">{label}</Text>
    </Pressable>
  );
}
