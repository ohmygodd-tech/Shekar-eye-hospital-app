import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, ErrorView, Loading, Screen, s } from '@/components/ui';
import { DEPT_ICONS, DoctorCard } from '@/components/cards';
import { useApi } from '@/lib/useApi';
import { colors, radius, space, type } from '@/lib/theme';
import type { Department, Doctor } from '@/lib/types';

export default function Book() {
  const [q, setQ] = useState('');
  const depts = useApi<Department[]>('/departments');
  const search = useApi<Doctor[]>(q.trim().length >= 2 ? `/doctors?q=${encodeURIComponent(q.trim())}` : null);

  return (
    <Screen edges={[]} refreshing={depts.refreshing} onRefresh={depts.refresh}>
      <View style={st.search}>
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search doctor or speciality" placeholderTextColor={colors.textSubtle} style={st.searchInput} returnKeyType="search" clearButtonMode="while-editing" />
      </View>

      <Card style={st.help} onPress={() => router.push('/symptom-checker')}>
        <Ionicons name="sparkles" size={20} color={colors.secondary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[type.body, { fontWeight: '600' }]}>Not sure which specialist?</Text>
          <Text style={type.small}>Describe your symptoms and we'll suggest one.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Card>

      {q.trim().length >= 2 ? (
        search.loading ? <Loading /> : (search.data ?? []).length === 0
          ? <Text style={[type.small, { textAlign: 'center', marginTop: space(8) }]}>No doctors found for "{q}"</Text>
          : search.data!.map((d) => <DoctorCard key={d.id} doctor={d} onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: d.id } })} />)
      ) : depts.loading ? <Loading /> : depts.error ? <ErrorView message={depts.error} onRetry={depts.refresh} /> : (
        <>
          <Text style={[type.h3, { marginBottom: space(3) }]}>Choose a speciality</Text>
          {depts.data!.map((d) => (
            <Pressable key={d.id} onPress={() => router.push({ pathname: '/doctors', params: { department: d.slug, name: d.name } })}
              style={({ pressed }) => [st.dept, pressed && { opacity: 0.85 }]}>
              <View style={st.icon}><Ionicons name={DEPT_ICONS[d.slug] ?? 'eye-outline'} size={22} color={colors.primary} /></View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{d.name}</Text>
                <Text style={type.small} numberOfLines={2}>{d.description}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[type.small, { fontWeight: '600' }]}>{d.doctorCount}</Text>
                <Text style={type.tiny}>{d.doctorCount === 1 ? 'DOCTOR' : 'DOCTORS'}</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.text, height: '100%' },
  help: { flexDirection: 'row', alignItems: 'center', marginVertical: space(4), backgroundColor: colors.secondarySoft, shadowOpacity: 0, elevation: 0 },
  dept: { ...s.row, backgroundColor: colors.white, borderRadius: radius.lg, padding: space(3), marginBottom: space(2.5), borderWidth: 1, borderColor: colors.border },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
