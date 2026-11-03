import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.primary, headerTitle: '', headerStyle: { backgroundColor: colors.white }, contentStyle: { backgroundColor: colors.white } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
