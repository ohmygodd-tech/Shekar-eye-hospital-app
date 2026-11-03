import React from 'react';
import { Alert, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Card, Empty, ErrorView, Loading, Screen, s } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { colors, space, type } from '@/lib/theme';
import { fmtDateTime, rupees } from '@/lib/format';
import type { Payment } from '@/lib/types';

export default function Payments() {
  const q = useApi<Payment[]>('/payments');
  async function open(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/links/receipts/${id}`);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) { Alert.alert('Could not open receipt', e instanceof Error ? e.message : ''); }
  }
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.refresh} />;
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.data!.length === 0 ? <Empty icon="receipt-outline" title="No payments yet" message="Receipts for online and counter payments will appear here." /> :
        q.data!.map((p) => (
          <Card key={p.id} style={{ marginBottom: space(3) }} onPress={() => open(p.id)}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={type.h3}>{rupees(p.amountPaise)}</Text>
              <Badge label={p.status === 'paid' ? 'Paid' : 'Refunded'} tone={p.status === 'paid' ? 'success' : 'warning'} />
            </View>
            <Text style={[type.small, { color: colors.text, marginTop: 4 }]}>{p.doctorName} · {p.patientName}</Text>
            <Text style={type.small}>{p.receiptNo} · {p.paidAt ? fmtDateTime(p.paidAt) : ''}</Text>
            <Text style={[type.small, { color: colors.primary, fontWeight: '600', marginTop: 6 }]}>View receipt →</Text>
          </Card>
        ))}
    </Screen>
  );
}
