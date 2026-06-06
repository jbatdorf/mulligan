import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-2xl font-bold text-black dark:text-white">Explore</Text>
        <Text className="text-neutral-500 dark:text-neutral-400">Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
