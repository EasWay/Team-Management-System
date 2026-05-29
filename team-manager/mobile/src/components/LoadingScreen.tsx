import { View, ActivityIndicator, Text } from 'react-native';

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
      <ActivityIndicator size="large" color="#0ea5e9" />
      <Text className="text-slate-500 dark:text-slate-400 mt-4 text-base">{message}</Text>
    </View>
  );
}
