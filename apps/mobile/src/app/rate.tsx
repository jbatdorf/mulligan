import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompareStep } from '@/components/rate/compare-step';
import { RoundForm } from '@/components/rate/round-form';
import { SearchStep, type SelectedCourse } from '@/components/rate/search-step';
import { SentimentStep, type RatingStepResult } from '@/components/rate/sentiment-step';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';

type State =
  | { step: 'search' }
  | { step: 'sentiment'; course: SelectedCourse }
  | { step: 'compare'; course: SelectedCourse; sessionId: string; pivotCourseId: string }
  | { step: 'round'; course: SelectedCourse; score: number; rank: number }
  | { step: 'done'; course: SelectedCourse; score: number; rank: number };

export default function RateScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ step: 'search' });

  const cancel = useMutation(trpc.rating.cancel.mutationOptions());

  // A rating session is live once we're comparing and until it finalizes.
  const sessionActive = state.step === 'compare';
  const sessionActiveRef = useRef(sessionActive);
  sessionActiveRef.current = sessionActive;

  // If the modal is dismissed mid-comparison, drop the server session so the
  // user isn't locked out for the 1h TTL.
  useEffect(() => {
    return () => {
      if (sessionActiveRef.current) cancel.mutate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (sessionActiveRef.current) cancel.mutate();
    router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.course.leaderboard.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.round.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.feed.list.queryKey() });
    router.back();
  }, [queryClient, trpc]);

  const onRatingResult = (course: SelectedCourse, res: RatingStepResult) => {
    if (res.done) {
      setState({ step: 'round', course, score: res.score, rank: res.rank });
    } else {
      setState({ step: 'compare', course, sessionId: res.sessionId, pivotCourseId: res.pivotCourseId });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-base font-semibold text-black dark:text-white">Log a round</Text>
        <Pressable onPress={close} hitSlop={12}>
          <Text className="text-base text-neutral-500">Close</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10"
        keyboardShouldPersistTaps="handled">
        {state.step === 'search' && (
          <SearchStep onPicked={(course) => setState({ step: 'sentiment', course })} />
        )}

        {state.step === 'sentiment' && (
          <SentimentStep
            course={state.course}
            onResult={(res) => onRatingResult(state.course, res)}
          />
        )}

        {state.step === 'compare' && (
          <CompareStep
            course={state.course}
            sessionId={state.sessionId}
            firstPivotCourseId={state.pivotCourseId}
            onDone={({ score, rank }) =>
              setState({ step: 'round', course: state.course, score, rank })
            }
          />
        )}

        {state.step === 'round' && (
          <RoundForm
            course={state.course}
            score={state.score}
            rank={state.rank}
            onLogged={() =>
              setState({
                step: 'done',
                course: state.course,
                score: state.score,
                rank: state.rank,
              })
            }
          />
        )}

        {state.step === 'done' && (
          <View className="flex-1 items-center justify-center gap-4 py-16">
            <Text className="text-5xl">⛳️</Text>
            <Text className="text-center text-2xl font-bold text-black dark:text-white">
              Round logged
            </Text>
            <Text className="text-center text-neutral-500">
              {state.course.name} · {state.score.toFixed(1)}
            </Text>
            <View className="w-full pt-4">
              <Button label="Done" onPress={finish} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
