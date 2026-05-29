import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantClasses = {
  primary:   { btn: 'bg-black dark:bg-white active:bg-neutral-800 dark:active:bg-neutral-200', text: 'text-white dark:text-black' },
  secondary: { btn: 'bg-neutral-100 dark:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 border border-neutral-200 dark:border-neutral-700', text: 'text-neutral-800 dark:text-neutral-200' },
  danger:    { btn: 'bg-red-600 active:bg-red-700', text: 'text-white' },
  ghost:     { btn: 'bg-transparent active:bg-neutral-100 dark:active:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-300' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const v = variantClasses[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={style}
      className={`${v.btn} ${fullWidth ? 'w-full' : ''} px-4 py-3 rounded-xl items-center justify-center flex-row gap-2 ${isDisabled ? 'opacity-60' : ''}`}
    >
      {loading && <ActivityIndicator size="small" color="white" />}
      <Text className={`${v.text} font-semibold text-base`}>{label}</Text>
    </TouchableOpacity>
  );
}
