import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { AppointmentCard } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { colors, radius, space } from '@/lib/theme';
import type { Appointment } from '@/lib/types';

export default function Appointments() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const q = useApi<Appointment[]>(`/appointments?scope=${tab}`);
  return (
    <Screen edges={[]} refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={st.seg}>
        {(['upcoming', 'past'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.segBtn, tab === t && st.segSel]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[st.segText, tab === t && { color: colors.primary }]}>{t === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
          </Pressable>
        ))}
      </View>
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.refresh} /> :
        q.data!.length === 0 ? (
          <Empty icon="calendar-outline" title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past visits yet'}
            message={tab === 'upcoming' ? 'Book a consultation with our eye specialists.' : undefined}
            action={tab === 'upcoming' ? 'Book appointment' : undefined} onAction={() => router.push('/(tabs)/book')} />
        ) : q.data!.map((a) => <AppointmentCard key={a.id} a={a} onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: a.id } })} />)}
    </Screen>
  );
}

const st = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: '#E8EEF2', borderRadius: radius.md, padding: 4, marginBottom: space(4) },
  segBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segSel: { backgroundColor: colors.white },
  segText: { fontWeight: '600', color: colors.textMuted },
});
