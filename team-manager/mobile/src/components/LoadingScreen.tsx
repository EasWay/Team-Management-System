import { View, ActivityIndicator, Text } from 'react-native';

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View
      style={{ flex: 1, backgroundColor: '#020617' }}
      className="items-center justify-center"
    >
      <ActivityIndicator size="large" color="#38bdf8" />
      <Text className="text-slate-400 mt-3 text-sm">{message}</Text>
    </View>
  );
}
