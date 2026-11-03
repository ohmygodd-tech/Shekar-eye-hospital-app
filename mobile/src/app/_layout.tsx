import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { NotificationRouter } from '@/lib/NotificationRouter';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useSession } from '@/lib/auth';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, user, patients } = useSession();
  const signedIn = !!user;
  const needsProfile = signedIn && patients.length === 0;

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  // Send the user to the right place when their session state changes.
  const segments = useSegments();
  const area = segments[0] as string | undefined;
  useEffect(() => {
    if (!ready) return;
    const PUBLIC = ['symptom-checker', 'assistant', 'about', 'privacy'];
    if (!signedIn && area !== '(auth)' && !PUBLIC.includes(area ?? '')) router.replace('/');
    else if (needsProfile && area !== 'onboarding') router.replace('/onboarding');
    else if (signedIn && !needsProfile && (area === '(auth)' || area === 'onboarding')) router.replace('/');
  }, [ready, signedIn, needsProfile, area]);

  if (!ready) return null;

  return (
    <>
    <NotificationRouter enabled={signedIn} />
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="onboarding" options={{ title: 'Your details', headerBackVisible: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="doctors/index" options={{ title: 'Choose a doctor' }} />
        <Stack.Screen name="doctors/[id]" options={{ title: 'Book appointment' }} />
        <Stack.Screen name="book/confirm" options={{ title: 'Confirm booking' }} />
        <Stack.Screen name="pay" options={{ title: 'Payment', presentation: 'modal' }} />
        <Stack.Screen name="appointment/[id]" options={{ title: 'Appointment' }} />
        <Stack.Screen name="appointment/reschedule" options={{ title: 'Reschedule' }} />
        <Stack.Screen name="record/[id]" options={{ title: 'Record' }} />
        <Stack.Screen name="family/index" options={{ title: 'Family members' }} />
        <Stack.Screen name="family/edit" options={{ title: 'Patient details' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="payments" options={{ title: 'Payments & receipts' }} />
      </Stack.Protected>
      {/* Available whether signed in or not */}
      <Stack.Screen name="symptom-checker" options={{ title: 'Eye symptom checker' }} />
      <Stack.Screen name="assistant" options={{ title: 'Help assistant' }} />
      <Stack.Screen name="about" options={{ title: 'About the hospital' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & terms' }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
