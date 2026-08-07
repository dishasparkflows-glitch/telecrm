import { router, Stack, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Loading } from '@/components/States';
import { useForegroundServices } from '@/hooks/useForegroundServices';
import { useEffect } from 'react';


function Guard() {
  const { user, loading } = useAuth(); const segments = useSegments();
  useForegroundServices(Boolean(user));
  useEffect(() => {
    if (loading) return;
    const login = segments[0] === 'login';
    if (!user && !login) router.replace('/login');
    if (user && login) router.replace('/dashboard');
  }, [user, loading, segments]);
  if (loading) return <Loading />;
  return <Stack screenOptions={{ headerBackTitle: 'Back' }}><Stack.Screen name="login" options={{ headerShown: false }} /><Stack.Screen name="(app)" options={{ headerShown: false }} /></Stack>;
}
export default function RootLayout() { return <AuthProvider><Guard /></AuthProvider>; }
