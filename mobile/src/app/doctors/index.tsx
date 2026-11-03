import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { DoctorCard } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import type { Doctor } from '@/lib/types';

export default function Doctors() {
  const { department, name } = useLocalSearchParams<{ department?: string; name?: string }>();
  const q = useApi<Doctor[]>(`/doctors${department ? `?department=${encodeURIComponent(department)}` : ''}`);
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: name || 'Doctors' }} />
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.refresh} /> :
        q.data!.length === 0 ? <Empty icon="people-outline" title="No doctors available" message="Please call the hospital to book in this speciality." /> :
        q.data!.map((d) => <DoctorCard key={d.id} doctor={d} onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: d.id } })} />)}
    </Screen>
  );
}
