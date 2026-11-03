import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Avatar, Badge, Button, Card, ErrorView, Loading, s } from '@/components/ui';
import { SlotPicker } from '@/components/SlotPicker';
import { useApi } from '@/lib/useApi';
import { colors, space, type } from '@/lib/theme';
import { fmtDate, fmtTime, rupees, weekdayName } from '@/lib/format';
import type { Doctor } from '@/lib/types';

export default function DoctorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<Doctor>(`/doctors/${id}`, { refetchOnFocus: false });
  const [pick, setPick] = useState<{ date: string; start: string } | null>(null);

  if (q.loading) return <Loading />;
  if (q.error || !q.data) return <ErrorView message={q.error || 'Not found'} onRetry={q.refresh} />;
  const d = q.data;
  const days = Array.from(new Set(d.schedule?.map((x) => x.weekday))).sort();
  const daysLabel = days.length === 6 && !days.includes(0) ? 'Mon – Sat' : days.map((x) => weekdayName(x).slice(0, 3)).join(', ');

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(6) }}>
        <Card>
          <View style={s.row}>
            <Avatar name={d.name} size={68} />
            <View style={{ flex: 1, marginLeft: space(4) }}>
              <Text style={type.h2}>{d.name}</Text>
              <Text style={[type.small, { color: colors.primary, fontWeight: '600' }]}>{d.department.name}</Text>
              {d.qualification ? <Text style={type.small}>{d.qualification}</Text> : null}
            </View>
          </View>
          <View style={[s.row, { marginTop: space(4), justifyContent: 'space-between' }]}>
            <Stat label="Experience" value={d.experienceYears ? `${d.experienceYears} yrs` : '—'} />
            <Stat label="Consultation" value={rupees(d.feePaise)} />
            <Stat label="OPD days" value={daysLabel || '—'} />
          </View>
          {d.languages?.length ? (
            <View style={[s.row, { flexWrap: 'wrap', gap: 6, marginTop: space(4) }]}>
              {d.languages.map((l) => <Badge key={l} label={l} tone="info" />)}
            </View>
          ) : null}
          {d.bio ? <Text style={[type.small, { marginTop: space(3), color: colors.text }]}>{d.bio}</Text> : null}
        </Card>

        <Text style={[type.h3, { marginTop: space(6), marginBottom: space(3) }]}>Select date & time</Text>
        <SlotPicker doctorId={d.id} value={pick} onChange={setPick} />
      </ScrollView>
      <View style={{ padding: space(4), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.white }}>
        {pick && <Text style={[type.small, { textAlign: 'center', marginBottom: 8 }]}>{fmtDate(pick.date, { weekday: true })} at {fmtTime(pick.start)}</Text>}
        <Button title="Continue" disabled={!pick}
          onPress={() => pick && router.push({ pathname: '/book/confirm', params: { doctorId: d.id, date: pick.date, start: pick.start } })} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type.h3, { fontSize: 15 }]} numberOfLines={1}>{value}</Text>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
    </View>
  );
}
