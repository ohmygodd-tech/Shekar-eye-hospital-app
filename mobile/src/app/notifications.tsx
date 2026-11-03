import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Empty, ErrorView, Loading, Screen, s } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { colors, space, type } from '@/lib/theme';
import { fmtDateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

export default function Notifications() {
  const q = useApi<Notification[]>('/me/notifications');
  const { reload } = useSession();
  useEffect(() => { api('/me/notifications/read', { body: {} }).then(reload).catch(() => {}); }, [reload]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.refresh} />;
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.data!.length === 0 ? <Empty icon="notifications-outline" title="No notifications" message="Appointment confirmations, reminders and report alerts will show up here." /> :
        q.data!.map((n) => (
          <Card key={n.id} style={{ marginBottom: space(3) }} onPress={() => {
            if (n.data?.type === 'appointment' && n.data.id) router.push({ pathname: '/appointment/[id]', params: { id: n.data.id } });
            else if (n.data?.type === 'record' && n.data.id) router.push({ pathname: '/record/[id]', params: { id: n.data.id } });
          }}>
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <Ionicons name={n.data?.type === 'record' ? 'document-text' : 'calendar'} size={20} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: space(3) }}>
                <Text style={[type.body, { fontWeight: n.readAt ? '500' : '700' }]}>{n.title}</Text>
                <Text style={[type.small, { color: colors.text }]}>{n.body}</Text>
                <Text style={[type.small, { fontSize: 12, marginTop: 4 }]}>{fmtDateTime(n.createdAt)}</Text>
              </View>
              {!n.readAt && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 }} />}
            </View>
          </Card>
        ))}
    </Screen>
  );
}
