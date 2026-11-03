import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: Icon, active: Icon) => ({ color, focused }: { color: unknown; focused: boolean }) =>
  <Ionicons name={focused ? active : name} size={23} color={color as string} />;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.border },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="book" options={{ title: 'Book', headerTitle: 'Book an appointment', tabBarIcon: icon('add-circle-outline', 'add-circle') }} />
      <Tabs.Screen name="appointments" options={{ title: 'Visits', headerTitle: 'My appointments', tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="records" options={{ title: 'Records', headerTitle: 'Medical records', tabBarIcon: icon('document-text-outline', 'document-text') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
