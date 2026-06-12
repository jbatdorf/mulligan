import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

const container: Record<Variant, string> = {
  primary: 'bg-green-600',
  secondary: 'bg-neutral-200 dark:bg-neutral-800',
};

const text: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-black dark:text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({ opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 })}
      className={`items-center justify-center rounded-2xl px-5 py-3 ${container[variant]}`}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : undefined} />
      ) : (
        <Text className={`text-base font-semibold ${text[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
