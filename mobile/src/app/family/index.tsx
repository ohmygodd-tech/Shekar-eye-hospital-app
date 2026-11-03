import React from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Button, Card, Screen, s } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { age, cap } from '@/lib/format';
import { space, type } from '@/lib/theme';

export default function Family() {
  const { patients, reload } = useSession();

  function remove(id: string, name: string) {
    Alert.alert(`Remove ${name}?`, 'Their past records stay with the hospital. You can add them again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api(`/me/patients/${id}`, { method: 'DELETE' }); await reload(); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : ''); }
      } },
    ]);
  }

  return (
    <Screen>
      <Text style={[type.small, { marginBottom: space(4) }]}>Book appointments and view records for your family from one account. Each person gets their own hospital patient ID.</Text>
      {patients.map((p) => (
        <Card key={p.id} style={{ marginBottom: space(3) }} onPress={() => router.push({ pathname: '/family/edit', params: { id: p.id } })}>
          <View style={s.row}>
            <Avatar name={p.name} />
            <View style={{ marginLeft: space(3), flex: 1 }}>
              <Text style={type.h3}>{p.name}</Text>
              <Text style={type.small}>
                {p.relation === 'self' ? 'You' : cap(p.relation)}{age(p.dob) !== null ? ` · ${age(p.dob)} yrs` : ''}{p.gender ? ` · ${cap(p.gender)}` : ''}
              </Text>
              <Text style={[type.small, { fontSize: 12 }]}>ID {p.mrn}</Text>
            </View>
            {p.relation !== 'self' && <Text onPress={() => remove(p.id, p.name)} style={{ color: '#D92D20', fontWeight: '600' }}>Remove</Text>}
          </View>
        </Card>
      ))}
      <Button title="Add family member" icon="person-add-outline" variant="secondary" onPress={() => router.push('/family/edit')} style={{ marginTop: space(2) }} />
    </Screen>
  );
}
