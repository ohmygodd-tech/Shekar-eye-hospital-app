import React from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Avatar, ListRow, Screen, s } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { tokens } from '@/lib/api';
import { colors, radius, shadow, space, type } from '@/lib/theme';

export default function Profile() {
  const { user, patients, unread, signOut } = useSession();
  const self = patients.find((p) => p.relation === 'self') ?? patients[0];

  function confirmSignOut() {
    Alert.alert('Log out?', 'You can log back in with your mobile number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  }

  function deleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your login and personal details and cancels upcoming appointments. Medical records are retained by the hospital as required by law. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account', style: 'destructive', onPress: async () => {
            try {
              await api('/me', { method: 'DELETE' });
              await tokens.clear();
              await signOut();
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Please try again');
            }
          },
        },
      ],
    );
  }

  return (
    <Screen edges={[]} padded={false}>
      <View style={st.header}>
        <Avatar name={user?.name} size={64} />
        <View style={{ marginLeft: space(4), flex: 1 }}>
          <Text style={type.h2}>{user?.name || 'Your profile'}</Text>
          <Text style={type.small}>{user?.phone}</Text>
          {self && <Text style={[type.small, { fontWeight: '600', color: colors.primary }]}>Patient ID: {self.mrn}</Text>}
        </View>
      </View>

      <Group title="Account">
        {self && <ListRow icon="person-outline" title="My details" subtitle="Name, date of birth, medical history" onPress={() => router.push({ pathname: '/family/edit', params: { id: self.id } })} />}
        <ListRow icon="people-outline" title="Family members" subtitle={`${patients.length} ${patients.length === 1 ? 'profile' : 'profiles'}`} onPress={() => router.push('/family')} />
        <ListRow icon="receipt-outline" title="Payments & receipts" onPress={() => router.push('/payments')} />
        <ListRow icon="notifications-outline" title="Notifications" subtitle={unread ? `${unread} unread` : undefined} onPress={() => router.push('/notifications')} />
      </Group>

      <Group title="Help">
        <ListRow icon="chatbubbles-outline" title="Help assistant" onPress={() => router.push('/assistant')} />
        <ListRow icon="pulse-outline" title="Eye symptom checker" onPress={() => router.push('/symptom-checker')} />
        <ListRow icon="business-outline" title="Hospital info & contact" onPress={() => router.push('/about')} />
        <ListRow icon="shield-checkmark-outline" title="Privacy policy & terms" onPress={() => router.push('/privacy')} />
      </Group>

      <Group>
        <ListRow icon="log-out-outline" title="Log out" onPress={confirmSignOut} danger />
        <ListRow icon="trash-outline" title="Delete account" onPress={deleteAccount} danger />
      </Group>

      <Text style={[type.small, { textAlign: 'center', marginVertical: space(6), fontSize: 12 }]}>
        Version {Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </Screen>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space(5), paddingHorizontal: space(4) }}>
      {title && <Text style={[type.tiny, { marginBottom: 8, marginLeft: 4 }]}>{title.toUpperCase()}</Text>}
      <View style={st.group}>{children}</View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { ...s.row, backgroundColor: colors.white, padding: space(5), borderBottomWidth: 1, borderColor: colors.border },
  group: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
});
