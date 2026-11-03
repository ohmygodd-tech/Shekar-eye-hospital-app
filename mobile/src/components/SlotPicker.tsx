import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { api } from '@/lib/api';
import { colors, radius, space, type } from '@/lib/theme';
import { dayNum, dayShort, fmtTime } from '@/lib/format';
import type { Slot } from '@/lib/types';

type Day = { date: string; total: number; free: number };

export function SlotPicker({ doctorId, value, onChange }: {
  doctorId: string; value: { date: string; start: string } | null; onChange: (v: { date: string; start: string } | null) => void;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(value?.date ?? null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Day[]>(`/doctors/${doctorId}/availability`).then((d) => {
      setDays(d);
      if (!date) setDate(d.find((x) => x.free > 0)?.date ?? d[0]?.date ?? null);
    }).catch((e) => setError(e.message));
  }, [doctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!date) return;
    setSlots(null);
    api<{ slots: Slot[] }>(`/doctors/${doctorId}/slots?date=${date}`).then((r) => setSlots(r.slots)).catch((e) => setError(e.message));
  }, [doctorId, date]);

  if (error) return <Text style={{ color: colors.danger }}>{error}</Text>;
  if (!days) return <ActivityIndicator color={colors.primary} style={{ marginVertical: space(6) }} />;

  const groups = slots ? [
    { label: 'Morning', items: slots.filter((s) => s.start < '12:00') },
    { label: 'Afternoon', items: slots.filter((s) => s.start >= '12:00' && s.start < '17:00') },
    { label: 'Evening', items: slots.filter((s) => s.start >= '17:00') },
  ].filter((g) => g.items.length) : [];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
        {days.map((d) => {
          const sel = d.date === date;
          const off = d.total === 0;
          return (
            <Pressable key={d.date} disabled={off} onPress={() => { setDate(d.date); onChange(null); }}
              style={[st.day, sel && st.daySel, off && { opacity: 0.4 }]} accessibilityState={{ selected: sel, disabled: off }}>
              <Text style={[st.dayW, sel && { color: '#CFE8F3' }]}>{dayShort(d.date).toUpperCase()}</Text>
              <Text style={[st.dayN, sel && { color: colors.white }]}>{dayNum(d.date)}</Text>
              <Text style={[st.dayF, sel && { color: '#CFE8F3' }, d.free === 0 && !off && { color: colors.danger }]}>
                {off ? 'Off' : d.free === 0 ? 'Full' : `${d.free} free`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!slots ? <ActivityIndicator color={colors.primary} style={{ marginVertical: space(6) }} /> :
        groups.length === 0 || slots.every((x) => !x.available) ? (
          <Text style={[type.small, { textAlign: 'center', marginVertical: space(6) }]}>No slots available on this day. Please pick another date.</Text>
        ) : groups.map((g) => (
          <View key={g.label} style={{ marginTop: space(4) }}>
            <Text style={[type.tiny, { marginBottom: 8 }]}>{g.label.toUpperCase()}</Text>
            <View style={st.slots}>
              {g.items.map((sl) => {
                const sel = value?.date === date && value?.start === sl.start;
                return (
                  <Pressable key={sl.start} disabled={!sl.available} onPress={() => onChange({ date: date!, start: sl.start })}
                    style={[st.slot, sel && st.slotSel, !sl.available && st.slotOff]} accessibilityState={{ selected: sel, disabled: !sl.available }}>
                    <Text style={[st.slotText, sel && { color: colors.white }, !sl.available && { color: colors.textSubtle, textDecorationLine: 'line-through' }]}>{fmtTime(sl.start)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
    </View>
  );
}

const st = StyleSheet.create({
  day: { width: 64, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginRight: 8 },
  daySel: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayW: { fontSize: 11, fontWeight: '600', color: colors.textSubtle },
  dayN: { fontSize: 20, fontWeight: '700', color: colors.text, marginVertical: 2 },
  dayF: { fontSize: 10.5, color: colors.success, fontWeight: '600' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31.5%', height: 42, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  slotSel: { backgroundColor: colors.primary },
  slotOff: { borderColor: colors.border, backgroundColor: colors.bg },
  slotText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
