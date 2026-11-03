import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Card, Chip, Field, KeyValue, Loading, Notice, Screen, s } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { colors, radius, space, type } from '@/lib/theme';
import { fmtDate, fmtTime, rupees } from '@/lib/format';
import type { Appointment, Doctor, PaymentOrder } from '@/lib/types';

export default function Confirm() {
  const { doctorId, date, start } = useLocalSearchParams<{ doctorId: string; date: string; start: string }>();
  const { patients, hospital } = useSession();
  const doc = useApi<Doctor>(`/doctors/${doctorId}`, { refetchOnFocus: false });
  const [patientId, setPatientId] = useState(patients[0]?.id);
  const [visitType, setVisitType] = useState<'new' | 'follow_up' | 'post_op'>('new');
  const [reason, setReason] = useState('');
  const [payMode, setPayMode] = useState<'online' | 'hospital'>('online');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (doc.loading || !doc.data) return <Loading />;
  const d = doc.data;
  const free = d.feePaise === 0;
  const online = hospital?.paymentProvider !== 'none';

  async function book() {
    setError('');
    setLoading(true);
    try {
      const r = await api<{ appointment: Appointment; payment: PaymentOrder | null }>('/appointments', {
        body: { patientId, doctorId, date, start, visitType, reason: reason.trim() || undefined, payMode: free || !online ? 'hospital' : payMode },
      });
      if (r.payment) {
        router.replace({ pathname: '/pay', params: { appointmentId: r.appointment.id, order: JSON.stringify(r.payment) } });
      } else {
        router.dismissAll();
        router.push({ pathname: '/appointment/[id]', params: { id: r.appointment.id, booked: '1' } });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Booking failed');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={s.row}>
          <Avatar name={d.name} />
          <View style={{ marginLeft: space(3), flex: 1 }}>
            <Text style={type.h3}>{d.name}</Text>
            <Text style={type.small}>{d.department.name}</Text>
          </View>
        </View>
        <View style={st.when}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
          <Text style={[type.body, { fontWeight: '600', marginLeft: 8 }]}>{fmtDate(date, { weekday: true, year: true })} · {fmtTime(start)}</Text>
        </View>
      </Card>

      <Text style={[type.h3, { marginTop: space(6), marginBottom: space(3) }]}>Who is the appointment for?</Text>
      {patients.map((p) => (
        <Pressable key={p.id} onPress={() => setPatientId(p.id)} style={[st.option, patientId === p.id && st.optionSel]} accessibilityRole="radio" accessibilityState={{ checked: patientId === p.id }}>
          <Ionicons name={patientId === p.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={patientId === p.id ? colors.primary : colors.textSubtle} />
          <Text style={[type.body, { marginLeft: 10, flex: 1 }]}>{p.name}</Text>
          <Text style={type.small}>{p.relation === 'self' ? 'You' : p.relation}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => router.push('/family/edit')} style={[s.row, { paddingVertical: 8 }]}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 6 }}>Add family member</Text>
      </Pressable>

      <Text style={[type.h3, { marginTop: space(5), marginBottom: space(3) }]}>Type of visit</Text>
      <View style={s.row}>
        <Chip label="First visit" selected={visitType === 'new'} onPress={() => setVisitType('new')} />
        <Chip label="Follow-up" selected={visitType === 'follow_up'} onPress={() => setVisitType('follow_up')} />
        <Chip label="After surgery" selected={visitType === 'post_op'} onPress={() => setVisitType('post_op')} />
      </View>

      <View style={{ marginTop: space(5) }}>
        <Field label="Reason for visit (optional)" value={reason} onChangeText={setReason} placeholder="e.g. blurred vision in right eye for 2 weeks" multiline maxLength={500} />
      </View>

      {!free && online && (
        <>
          <Text style={[type.h3, { marginBottom: space(3) }]}>Payment</Text>
          <Pressable onPress={() => setPayMode('online')} style={[st.option, payMode === 'online' && st.optionSel]}>
            <Ionicons name={payMode === 'online' ? 'radio-button-on' : 'radio-button-off'} size={20} color={payMode === 'online' ? colors.primary : colors.textSubtle} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={type.body}>Pay online now</Text>
              <Text style={type.small}>UPI, cards, net banking · skip the billing queue</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setPayMode('hospital')} style={[st.option, payMode === 'hospital' && st.optionSel]}>
            <Ionicons name={payMode === 'hospital' ? 'radio-button-on' : 'radio-button-off'} size={20} color={payMode === 'hospital' ? colors.primary : colors.textSubtle} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={type.body}>Pay at hospital</Text>
              <Text style={type.small}>Pay at the reception counter on arrival</Text>
            </View>
          </Pressable>
        </>
      )}

      <Card style={{ marginTop: space(4) }}>
        <KeyValue k="Consultation fee" v={free ? 'Free' : rupees(d.feePaise)} />
        <View style={[s.row, { justifyContent: 'space-between', paddingTop: 10 }]}>
          <Text style={type.h3}>Total</Text>
          <Text style={type.h2}>{free ? '₹0' : rupees(d.feePaise)}</Text>
        </View>
      </Card>

      <Notice tone="info" icon="time-outline">
        Please arrive 15 minutes early. Bring your current glasses and old reports. If drops are used to dilate your eyes, avoid driving for a few hours.
        {hospital ? ` Free cancellation up to ${hospital.booking.cancelCutoffHours} hours before.` : ''}
      </Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button title={free || !online || payMode === 'hospital' ? 'Confirm booking' : `Pay ${rupees(d.feePaise)} & book`} onPress={book} loading={loading} disabled={!patientId} />
    </Screen>
  );
}

const st = StyleSheet.create({
  when: { flexDirection: 'row', alignItems: 'center', marginTop: space(4), backgroundColor: colors.primarySoft, padding: 12, borderRadius: radius.md },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  optionSel: { borderColor: colors.primary, backgroundColor: '#F4FAFD' },
});
