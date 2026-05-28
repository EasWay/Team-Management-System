import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  iconColor?: string;
}

export function EmptyState({ title, description, icon = 'file-tray-outline', iconColor = '#475569' }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Ionicons name={icon} size={48} color={iconColor} />
      <Text className="text-lg font-semibold text-slate-200 text-center mt-4">{title}</Text>
      {description && (
        <Text className="text-sm text-slate-400 text-center mt-2">{description}</Text>
      )}
    </View>
  );
}
