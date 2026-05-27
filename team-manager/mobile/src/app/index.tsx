import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function Root() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen message="Starting up..." />;
  if (isAuthenticated) return <Redirect href="/(app)/" />;
  return <Redirect href="/(auth)/login" />;
}
