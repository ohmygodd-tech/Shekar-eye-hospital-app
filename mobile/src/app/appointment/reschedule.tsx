import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Button } from '@/components/ui';
import { SlotPicker } from '@/components/SlotPicker';
import { api, ApiError } from '@/lib/api';
import { colors, space, type } from '@/lib/theme';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Appointment } from '@/lib/types';

export default function Reschedule() {
  const { id, doctorId } = useLocalSearchParams<{ id: string; doctorId: string }>();
  const [pick, setPick] = useState<{ date: string; start: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await api<{ appointment: Appointment }>(`/appointments/${id}/reschedule`, { body: pick });
      router.dismissAll();
      router.push({ pathname: '/appointment/[id]', params: { id: r.appointment.id } });
    } catch (e) {
      Alert.alert('Could not reschedule', e instanceof ApiError ? e.message : 'Please try again');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(4) }}>
        <Text style={[type.small, { marginBottom: space(4) }]}>Pick a new date and time. Any payment already made carries over.</Text>
        <SlotPicker doctorId={doctorId} value={pick} onChange={setPick} />
      </ScrollView>
      <View style={{ padding: space(4), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white }}>
        {pick && <Text style={[type.small, { textAlign: 'center', marginBottom: 8 }]}>New time: {fmtDate(pick.date, { weekday: true })} at {fmtTime(pick.start)}</Text>}
        <Button title="Confirm new time" onPress={submit} disabled={!pick} loading={busy} />
      </View>
    </SafeAreaView>
  );
}
