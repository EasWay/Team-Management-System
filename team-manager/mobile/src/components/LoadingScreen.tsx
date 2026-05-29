import { View, ActivityIndicator, Text } from 'react-native';

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-black">
      <ActivityIndicator size="large" color="#0A0A0A" />
      <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-base">{message}</Text>
    </View>
  );
}
