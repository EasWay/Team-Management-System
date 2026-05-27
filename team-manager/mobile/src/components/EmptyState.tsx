import { View, Text } from 'react-native';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = '📭' }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-lg font-semibold text-slate-200 text-center">{title}</Text>
      {description && (
        <Text className="text-sm text-slate-400 text-center mt-2">{description}</Text>
      )}
    </View>
  );
}
