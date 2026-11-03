import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui';
import { PatientForm } from '@/components/PatientForm';
import { useSession } from '@/lib/auth';
import { api } from '@/lib/api';

export default function EditPatient() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { patients, reload } = useSession();
  const existing = id ? patients.find((p) => p.id === id) : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? (existing.relation === 'self' ? 'My details' : existing.name) : 'Add family member' }} />
      <PatientForm
        initial={existing}
        self={existing?.relation === 'self'}
        submitLabel={existing ? 'Save changes' : 'Add member'}
        onSubmit={async (p) => {
          if (existing) {
            const { relation, ...rest } = p;
            await api(`/me/patients/${existing.id}`, { method: 'PATCH', body: rest });
            if (existing.relation === 'self') await api('/me', { method: 'PATCH', body: { name: p.name } });
          } else {
            await api('/me/patients', { body: p });
          }
          await reload();
          router.back();
        }}
      />
    </Screen>
  );
}
