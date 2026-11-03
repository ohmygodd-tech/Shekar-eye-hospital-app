import React from 'react';
import { Text } from 'react-native';
import { Screen } from '@/components/ui';
import { PatientForm } from '@/components/PatientForm';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { space, type } from '@/lib/theme';

export default function Onboarding() {
  const { reload, signOut } = useSession();
  return (
    <Screen>
      <Text style={type.h2}>Welcome! Let's set up your profile</Text>
      <Text style={[type.small, { marginTop: 4, marginBottom: space(6) }]}>
        You can add family members later and book for them from the same account.
      </Text>
      <PatientForm
        self
        consent
        submitLabel="Continue"
        onSubmit={async (p) => {
          await api('/me', { method: 'PATCH', body: { name: p.name, consent: true } });
          await api('/me/patients', { body: { ...p, relation: 'self' } });
          await reload();
        }}
      />
      <Text onPress={signOut} style={[type.small, { textAlign: 'center', marginTop: space(6), textDecorationLine: 'underline' }]}>
        Use a different number
      </Text>
    </Screen>
  );
}
