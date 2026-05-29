import { View, Text } from 'react-native';

const variantStyles: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-neutral-200 dark:bg-neutral-700', text: 'text-neutral-700 dark:text-neutral-300' },
  primary: { bg: 'bg-black dark:bg-white',             text: 'text-white dark:text-black' },
  success: { bg: 'bg-neutral-800 dark:bg-neutral-200', text: 'text-white dark:text-black' },
  warning: { bg: 'bg-neutral-500 dark:bg-neutral-400', text: 'text-white dark:text-black' },
  danger:  { bg: 'bg-red-600',                         text: 'text-white' },
  info:    { bg: 'bg-neutral-400 dark:bg-neutral-600', text: 'text-white' },
};

interface BadgeProps {
  label: string;
  variant?: keyof typeof variantStyles;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const style = variantStyles[variant] ?? variantStyles.default;
  return (
    <View className={`${style.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${style.text} text-xs font-medium`}>{label}</Text>
    </View>
  );
}
