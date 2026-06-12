import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';
import type { SelectedCourse } from './search-step';

const todayISO = () => new Date().toISOString().slice(0, 10);

type Props = {
  course: SelectedCourse;
  score: number;
  rank: number;
  onLogged: () => void;
};

export function RoundForm({ course, score, rank, onLogged }: Props) {
  const trpc = useTRPC();
  const [playedAt, setPlayedAt] = useState(todayISO());
  const [strokes, setStrokes] = useState('');
  const [notes, setNotes] = useState('');
  const [hidden, setHidden] = useState(false);

  const create = useMutation(
    trpc.round.create.mutationOptions({ onSuccess: () => onLogged() }),
  );

  const strokesNum = strokes ? Number(strokes) : undefined;
  const strokesValid = strokesNum === undefined || (strokesNum >= 18 && strokesNum <= 250);

  const submit = () =>
    create.mutate({
      courseId: course.id,
      playedAt,
      score: strokesValid ? strokesNum : undefined,
      notes: notes.trim() || undefined,
      hidden,
    });

  return (
    <View className="flex-1 gap-5">
      <View className="items-center gap-1 rounded-2xl bg-green-100 py-6 dark:bg-green-950">
        <Text className="text-sm font-medium text-green-700 dark:text-green-400">
          You rated {course.name}
        </Text>
        <Text className="text-5xl font-extrabold text-green-700 dark:text-green-400">
          {score.toFixed(1)}
        </Text>
        <Text className="text-sm text-green-700 dark:text-green-400">#{rank} in this list</Text>
      </View>

      <Text className="text-lg font-bold text-black dark:text-white">Round details</Text>

      <Field label="Date played">
        <TextInput
          value={playedAt}
          onChangeText={setPlayedAt}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          className="rounded-xl bg-neutral-100 px-4 py-3 text-base text-black dark:bg-neutral-900 dark:text-white"
        />
      </Field>

      <Field label="Score (strokes, optional)">
        <TextInput
          value={strokes}
          onChangeText={setStrokes}
          placeholder="e.g. 82"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          className="rounded-xl bg-neutral-100 px-4 py-3 text-base text-black dark:bg-neutral-900 dark:text-white"
        />
        {!strokesValid && <Text className="text-xs text-red-500">Enter a score between 18 and 250.</Text>}
      </Field>

      <Field label="Notes (optional)">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it go?"
          placeholderTextColor="#9ca3af"
          multiline
          className="min-h-20 rounded-xl bg-neutral-100 px-4 py-3 text-base text-black dark:bg-neutral-900 dark:text-white"
        />
      </Field>

      <View className="flex-row items-center justify-between">
        <Text className="text-base text-black dark:text-white">Hide from activity feed</Text>
        <Switch value={hidden} onValueChange={setHidden} />
      </View>

      {create.isError && <Text className="text-red-500">{create.error.message}</Text>}

      <Button
        label="Log round"
        onPress={submit}
        loading={create.isPending}
        disabled={!strokesValid}
      />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-neutral-500">{label}</Text>
      {children}
    </View>
  );
}
