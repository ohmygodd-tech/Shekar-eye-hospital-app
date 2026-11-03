import React, { useState } from 'react';
import { Alert, Linking, Text, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, ErrorView, KeyValue, Loading, Notice, Screen, s } from '@/components/ui';
import { STATUS } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { colors, radius, space, type } from '@/lib/theme';
import { cap, fmtDate, fmtTime, rupees } from '@/lib/format';
import type { Appointment, PaymentOrder } from '@/lib/types';

const PAY_LABEL = { unpaid: 'Unpaid', paid: 'Paid online', refunded: 'Refunded', pay_at_hospital: 'Pay at hospital' };

export default function AppointmentDetail() {
  const { id, booked } = useLocalSearchParams<{ id: string; booked?: string }>();
  const { hospital } = useSession();
  const q = useApi<Appointment>(`/appointments/${id}`);
  const [busy, setBusy] = useState(false);

  if (q.loading) return <Loading />;
  if (q.error || !q.data) return <ErrorView message={q.error || 'Not found'} onRetry={q.refresh} />;
  const a = q.data;
  const st = STATUS[a.status];
  const active = ['confirmed', 'pending_payment', 'checked_in'].includes(a.status);

  function cancel() {
    Alert.alert('Cancel appointment?', a.paymentStatus === 'paid' ? 'Your payment will be refunded to the original payment method in 5–7 working days.' : 'This slot will be released for other patients.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel appointment', style: 'destructive', onPress: async () => {
          setBusy(true);
          try { await api(`/appointments/${a.id}/cancel`, { body: {} }); await q.reload(); } catch (e) { Alert.alert('Could not cancel', e instanceof ApiError ? e.message : 'Try again'); } finally { setBusy(false); }
        },
      },
    ]);
  }

  async function payNow() {
    setBusy(true);
    try {
      const r = await api<{ payment: PaymentOrder }>(`/appointments/${a.id}/pay`, { body: {} });
      router.push({ pathname: '/pay', params: { appointmentId: a.id, order: JSON.stringify(r.payment) } });
    } catch (e) {
      Alert.alert('Payment', e instanceof ApiError ? e.message : 'Try again');
    } finally { setBusy(false); }
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {booked && a.status === 'confirmed' && (
        <View style={ss.success}>
          <Ionicons name="checkmark-circle" size={52} color={colors.success} />
          <Text style={[type.h2, { marginTop: 8 }]}>Appointment booked!</Text>
          <Text style={type.small}>We've sent a confirmation to your phone.</Text>
        </View>
      )}

      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Badge label={st.label} tone={st.tone} />
          {a.tokenNo ? <Text style={[type.small, { fontWeight: '700', color: colors.text }]}>Token #{a.tokenNo}</Text> : null}
        </View>
        <View style={ss.when}>
          <View style={{ alignItems: 'center', marginRight: space(4) }}>
            <Text style={ss.whenDay}>{fmtDate(a.date).split(' ')[0]}</Text>
            <Text style={ss.whenMon}>{fmtDate(a.date).split(' ')[1].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{fmtDate(a.date, { weekday: true, year: true })}</Text>
            <Text style={type.small}>{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</Text>
          </View>
        </View>
        <View style={s.row}>
          <Avatar name={a.doctor.name} />
          <View style={{ marginLeft: space(3), flex: 1 }}>
            <Text style={type.h3}>{a.doctor.name}</Text>
            <Text style={type.small}>{a.doctor.department}</Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: space(3) }}>
        <KeyValue k="Patient" v={`${a.patient.name} (${a.patient.mrn})`} />
        <KeyValue k="Visit type" v={cap(a.visitType === 'post_op' ? 'after surgery' : a.visitType)} />
        {a.reason ? <KeyValue k="Reason" v={a.reason} /> : null}
        <KeyValue k="Fee" v={rupees(a.feePaise)} />
        <KeyValue k="Payment" v={PAY_LABEL[a.paymentStatus]} />
        {a.cancelReason && a.status === 'cancelled' ? <KeyValue k="Note" v={a.cancelReason} /> : null}
      </Card>

      {a.status === 'pending_payment' && (
        <>
          <Notice tone="warning">Complete payment to confirm this slot. Unpaid bookings are released automatically after a few minutes.</Notice>
          <Button title={`Pay ${rupees(a.feePaise)}`} onPress={payNow} loading={busy} />
        </>
      )}

      {active && a.status !== 'pending_payment' && (
        <Notice icon="information-circle-outline">
          Please arrive 15 minutes early and show this screen at reception. Bring your glasses and previous reports.
        </Notice>
      )}

      {active && (
        <View style={{ gap: space(3), marginTop: space(2) }}>
          {hospital?.mapsUrl ? <Button title="Get directions" icon="navigate-outline" variant="secondary" onPress={() => Linking.openURL(hospital.mapsUrl)} /> : null}
          {hospital ? <Button title="Call hospital" icon="call-outline" variant="outline" onPress={() => Linking.openURL(`tel:${hospital.phone.replace(/[^\d+]/g, '')}`)} /> : null}
          {a.canChange && a.status === 'confirmed' && (
            <Button title="Reschedule" icon="calendar-outline" variant="outline" onPress={() => router.push({ pathname: '/appointment/reschedule', params: { id: a.id, doctorId: a.doctor.id } })} />
          )}
          {a.canChange && <Button title="Cancel appointment" variant="danger" onPress={cancel} loading={busy} />}
          {!a.canChange && a.status === 'confirmed' && (
            <Text style={[type.small, { textAlign: 'center' }]}>Online changes close {hospital?.booking.cancelCutoffHours ?? 2} hours before your slot. Please call us to make changes.</Text>
          )}
        </View>
      )}

      {a.status === 'completed' && (
        <Button title="View reports & prescription" icon="document-text-outline" variant="secondary" onPress={() => router.push('/(tabs)/records')} style={{ marginTop: space(2) }} />
      )}
      {['completed', 'cancelled', 'no_show'].includes(a.status) && (
        <Button title="Book again" variant="outline" style={{ marginTop: space(3) }} onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: a.doctor.id } })} />
      )}
    </Screen>
  );
}

const ss = StyleSheet.create({
  success: { alignItems: 'center', marginBottom: space(5) },
  when: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space(3), marginVertical: space(4) },
  whenDay: { fontSize: 26, fontWeight: '800', color: colors.primary },
  whenMon: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
