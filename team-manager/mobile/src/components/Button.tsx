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
  primary: { btn: 'bg-sky-600 active:bg-sky-700', text: 'text-white' },
  secondary: { btn: 'bg-slate-100 dark:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200 dark:border-slate-600', text: 'text-slate-800 dark:text-slate-200' },
  danger: { btn: 'bg-red-600 active:bg-red-700', text: 'text-white' },
  ghost: { btn: 'bg-transparent active:bg-slate-100 dark:active:bg-slate-800', text: 'text-sky-500 dark:text-sky-400' },
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
