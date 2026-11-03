import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, ErrorView, Loading, Screen, s } from '@/components/ui';
import { RECORD_META } from '@/components/recordMeta';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';
import { fmtDateTime } from '@/lib/format';
import type { MedicalRecord } from '@/lib/types';



export default function Records() {
  const { patients } = useSession();
  const [patientId, setPatientId] = useState<string | null>(null);
  const q = useApi<MedicalRecord[]>(`/records${patientId ? `?patientId=${patientId}` : ''}`);

  return (
    <Screen edges={[]} refreshing={q.refreshing} onRefresh={q.refresh}>
      {patients.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(4) }}>
          <Chip label="Everyone" selected={!patientId} onPress={() => setPatientId(null)} />
          {patients.map((p) => <Chip key={p.id} label={p.name.split(' ')[0]} selected={patientId === p.id} onPress={() => setPatientId(p.id)} />)}
        </ScrollView>
      )}
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.refresh} /> :
        q.data!.length === 0 ? (
          <Empty icon="folder-open-outline" title="No records yet"
            message="Eye test results, glasses prescriptions and reports from your visits will appear here." />
        ) : q.data!.map((r) => {
          const m = RECORD_META[r.type];
          return (
            <Card key={r.id} style={{ marginBottom: space(3) }} onPress={() => router.push({ pathname: '/record/[id]', params: { id: r.id } })}>
              <View style={s.row}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={m.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: space(3) }}>
                  <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={type.small}>{m.label} · {r.patient.name}</Text>
                  <Text style={[type.small, { fontSize: 12 }]}>{fmtDateTime(r.createdAt)}</Text>
                </View>
                {r.hasFile && <Ionicons name="attach" size={18} color={colors.textSubtle} />}
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </View>
            </Card>
          );
        })}
    </Screen>
  );
}
