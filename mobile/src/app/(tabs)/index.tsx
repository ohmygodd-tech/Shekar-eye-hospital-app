import React from 'react';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, RefreshControl } from 'react-native';
import { Card, SectionHeader, s, type IconName } from '@/components/ui';
import { AppointmentCard, DEPT_ICONS } from '@/components/cards';
import { useSession } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { colors, radius, shadow, space, type } from '@/lib/theme';
import type { Appointment, Department } from '@/lib/types';

function greeting() {
  const h = new Date(Date.now() + 330 * 60000).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user, hospital, unread } = useSession();
  const appts = useApi<Appointment[]>('/appointments?scope=upcoming');
  const depts = useApi<Department[]>('/departments');
  const next = appts.data?.find((a) => a.status !== 'pending_payment') ?? appts.data?.[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
        refreshControl={<RefreshControl refreshing={appts.refreshing} onRefresh={() => { appts.refresh(); depts.reload(); }} tintColor={colors.primary} />}
      >
        <View style={[s.row, { justifyContent: 'space-between', marginBottom: space(5) }]}>
          <View style={{ flex: 1 }}>
            <Text style={type.small}>{greeting()},</Text>
            <Text style={type.h1} numberOfLines={1}>{user?.name?.split(' ')[0] || 'there'} 👋</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={st.bell} accessibilityLabel={`Notifications, ${unread} unread`}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 && <View style={st.dot}><Text style={st.dotText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </Pressable>
        </View>

        {next ? (
          <AppointmentCard a={next} highlight onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: next.id } })} />
        ) : (
          <Card style={st.cta} onPress={() => router.push('/(tabs)/book')}>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: colors.white }]}>Book an eye check-up</Text>
              <Text style={{ color: '#CFE8F3', marginTop: 4, fontSize: 13.5 }}>Choose a specialist and a time that suits you.</Text>
            </View>
            <View style={st.ctaIcon}><Ionicons name="arrow-forward" size={22} color={colors.primary} /></View>
          </Card>
        )}

        <View style={st.grid}>
          <Quick icon="calendar" label="Book visit" onPress={() => router.push('/(tabs)/book')} />
          <Quick icon="pulse" label="Symptom checker" onPress={() => router.push('/symptom-checker')} />
          <Quick icon="document-text" label="Reports" onPress={() => router.push('/(tabs)/records')} />
          <Quick icon="chatbubbles" label="Ask us" onPress={() => router.push('/assistant')} />
        </View>

        <Card style={st.emergency} onPress={() => hospital && Linking.openURL(`tel:${hospital.emergencyPhone.replace(/[^\d+]/g, '')}`)}>
          <View style={[st.qIcon, { backgroundColor: colors.dangerSoft, marginBottom: 0 }]}><Ionicons name="call" size={20} color={colors.danger} /></View>
          <View style={{ flex: 1, marginLeft: space(3) }}>
            <Text style={[type.h3, { color: colors.danger }]}>Eye emergency?</Text>
            <Text style={type.small}>Injury, chemical splash or sudden vision loss — call now</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </Card>

        <SectionHeader title="Our specialities" action="See all" onAction={() => router.push('/(tabs)/book')} />
        <View style={st.deptGrid}>
          {(depts.data ?? []).slice(0, 6).map((d) => (
            <Pressable key={d.id} style={st.dept} onPress={() => router.push({ pathname: '/doctors', params: { department: d.slug, name: d.name } })}>
              <Ionicons name={DEPT_ICONS[d.slug] ?? 'eye-outline'} size={24} color={colors.primary} />
              <Text style={st.deptText} numberOfLines={2}>{d.name}</Text>
            </Pressable>
          ))}
        </View>

        <SectionHeader title="Eye care tips" />
        <Card>
          {[
            ['sunny-outline', 'Wear UV-protective sunglasses outdoors to reduce cataract risk.'],
            ['phone-portrait-outline', 'Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.'],
            ['water-outline', 'Diabetic? Get a dilated retina check every year, even if vision is fine.'],
          ].map(([i, t]) => (
            <View key={t} style={[s.row, { alignItems: 'flex-start', marginBottom: 10 }]}>
              <Ionicons name={i as IconName} size={18} color={colors.secondary} style={{ marginTop: 1 }} />
              <Text style={[type.small, { flex: 1, marginLeft: 10, color: colors.text }]}>{t}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [st.quick, pressed && { opacity: 0.85 }]} onPress={onPress} accessibilityRole="button">
      <View style={st.qIcon}><Ionicons name={icon} size={22} color={colors.primary} /></View>
      <Text style={st.qText}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow },
  dot: { position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  dotText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  cta: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', marginBottom: space(3) },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(2) },
  quick: { width: '23.5%', backgroundColor: colors.white, borderRadius: radius.lg, paddingVertical: space(3), alignItems: 'center', ...shadow },
  qIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qText: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emergency: { flexDirection: 'row', alignItems: 'center', marginTop: space(4), borderWidth: 1, borderColor: '#FECDCA' },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space(3) },
  dept: { width: '31.5%', backgroundColor: colors.white, borderRadius: radius.lg, padding: space(3), minHeight: 92, ...shadow },
  deptText: { fontSize: 12.5, fontWeight: '600', color: colors.text, marginTop: 8 },
});
