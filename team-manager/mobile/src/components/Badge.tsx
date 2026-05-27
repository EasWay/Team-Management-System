import { View, Text } from 'react-native';

interface VariantStyle {
  container: string;
  text: string;
}

const variantStyles: Record<string, VariantStyle> = {
  default: {
    container: 'bg-slate-800 border border-slate-700',
    text: 'text-slate-300',
  },
  primary: {
    container: 'bg-sky-500/20 border border-sky-500/40',
    text: 'text-sky-300',
  },
  success: {
    container: 'bg-emerald-500/20 border border-emerald-500/40',
    text: 'text-emerald-300',
  },
  warning: {
    container: 'bg-amber-500/20 border border-amber-500/40',
    text: 'text-amber-300',
  },
  danger: {
    container: 'bg-rose-500/20 border border-rose-500/40',
    text: 'text-rose-300',
  },
  info: {
    container: 'bg-blue-500/20 border border-blue-500/40',
    text: 'text-blue-300',
  },
};

interface BadgeProps {
  label: string;
  variant?: keyof typeof variantStyles;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const style = variantStyles[variant] ?? variantStyles.default;
  return (
    <View className={`${style.container} px-2.5 py-1 rounded-full`}>
      <Text className={`${style.text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
