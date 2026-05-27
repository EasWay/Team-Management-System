import { View, Text } from 'react-native';

const variantStyles: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-slate-700', text: 'text-slate-200' },
  primary: { bg: 'bg-sky-600', text: 'text-white' },
  success: { bg: 'bg-emerald-600', text: 'text-white' },
  warning: { bg: 'bg-amber-500', text: 'text-white' },
  danger: { bg: 'bg-red-600', text: 'text-white' },
  info: { bg: 'bg-blue-600', text: 'text-white' },
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
