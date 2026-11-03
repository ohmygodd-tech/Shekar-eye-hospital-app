import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, s, type IconName } from './ui';
import { colors, space, type } from '@/lib/theme';
import { fmtTime, relativeDay, rupees } from '@/lib/format';
import type { Appointment, ApptStatus, Doctor } from '@/lib/types';

export const STATUS: Record<ApptStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending_payment: { label: 'Payment pending', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  checked_in: { label: 'Checked in', tone: 'info' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'Missed', tone: 'danger' },
};

export const DEPT_ICONS: Record<string, IconName> = {
  general: 'eye-outline', cataract: 'ellipse-outline', retina: 'scan-outline', glaucoma: 'speedometer-outline',
  cornea: 'water-outline', refractive: 'glasses-outline', pediatric: 'happy-outline', squint: 'swap-horizontal-outline',
  oculoplasty: 'cut-outline', emergency: 'medkit-outline',
};

export function DoctorCard({ doctor, onPress }: { doctor: Doctor; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: space(3) }}>
      <View style={s.row}>
        <Avatar name={doctor.name} size={56} />
        <View style={{ flex: 1, marginLeft: space(3) }}>
          <Text style={type.h3}>{doctor.name}</Text>
          <Text style={[type.small, { color: colors.primary, fontWeight: '600' }]}>{doctor.department.name}</Text>
          {doctor.qualification ? <Text style={type.small} numberOfLines={1}>{doctor.qualification}</Text> : null}
          <View style={[s.row, { marginTop: 6, flexWrap: 'wrap' }]}>
            {doctor.experienceYears ? <Meta icon="briefcase-outline" text={`${doctor.experienceYears} yrs`} /> : null}
            {doctor.languages?.length ? <Meta icon="chatbubble-ellipses-outline" text={doctor.languages.slice(0, 3).join(', ')} /> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.h3, { color: colors.text }]}>{rupees(doctor.feePaise)}</Text>
          <Text style={type.tiny}>FEE</Text>
        </View>
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={[s.row, { marginRight: 12 }]}>
      <Ionicons name={icon} size={13} color={colors.textSubtle} />
      <Text style={[type.small, { marginLeft: 4, fontSize: 12.5 }]}>{text}</Text>
    </View>
  );
}

export function AppointmentCard({ a, onPress, highlight }: { a: Appointment; onPress?: () => void; highlight?: boolean }) {
  const st = STATUS[a.status];
  return (
    <Card onPress={onPress} style={[{ marginBottom: space(3) }, highlight && { backgroundColor: colors.primary }]}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          <Ionicons name="calendar-outline" size={16} color={highlight ? '#CFE8F3' : colors.primary} />
          <Text style={[type.h3, { marginLeft: 6 }, highlight && { color: colors.white }]}>
            {relativeDay(a.date)} · {fmtTime(a.startTime)}
          </Text>
        </View>
        {highlight ? (a.tokenNo ? <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 12 }}>Token #{a.tokenNo}</Text></View> : null)
          : <Badge label={st.label} tone={st.tone} />}
      </View>
      <View style={[s.row, { marginTop: space(3) }]}>
        <Avatar name={a.doctor.name} size={42} tone={highlight ? 'rgba(255,255,255,0.9)' : colors.primarySoft} />
        <View style={{ marginLeft: space(3), flex: 1 }}>
          <Text style={[type.body, { fontWeight: '600' }, highlight && { color: colors.white }]}>{a.doctor.name}</Text>
          <Text style={[type.small, highlight && { color: '#CFE8F3' }]}>{a.doctor.department} · for {a.patient.name}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={18} color={highlight ? colors.white : colors.textSubtle} />}
      </View>
    </Card>
  );
}
