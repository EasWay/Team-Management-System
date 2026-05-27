import { View, Text } from 'react-native';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = '📭' }: EmptyStateProps) {
  return (
    <View
      style={{ paddingVertical: 48 }}
      className="flex-1 items-center justify-center px-6"
    >
      {/* Emoji in subtle circle */}
      <View
        style={{ width: 80, height: 80, backgroundColor: '#1e293b' }}
        className="rounded-full items-center justify-center"
      >
        <Text style={{ fontSize: 36 }}>{icon}</Text>
      </View>

      {/* Title */}
      <Text className="text-white text-xl font-bold mt-4 text-center">
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          style={{ maxWidth: 240 }}
          className="text-slate-400 text-sm text-center mt-2"
        >
          {description}
        </Text>
      )}
    </View>
  );
}
