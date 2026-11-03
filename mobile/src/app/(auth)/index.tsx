import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Link } from 'expo-router';
import { Button, s as ui } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { colors, radius, space, type } from '@/lib/theme';
import { useSession } from '@/lib/auth';

export default function Login() {
  const { hospital } = useSession();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(phone);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const r = await api<{ phone: string; devOtp?: string }>('/auth/otp/request', { body: { phone }, auth: false });
      router.push({ pathname: '/(auth)/otp', params: { phone: r.phone, devOtp: r.devOtp ?? '' } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space(6) }} keyboardShouldPersistTaps="handled">
          <View style={st.hero}>
            <View style={st.logo}><Ionicons name="eye" size={38} color={colors.white} /></View>
            <Text style={[type.h1, { marginTop: space(5), textAlign: 'center' }]}>{hospital?.name ?? 'Shekar Eye Hospital'}</Text>
            <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{hospital?.tagline ?? 'Caring for your vision'}</Text>
          </View>

          <Text style={[type.h2, { marginTop: space(10) }]}>Log in or sign up</Text>
          <Text style={[type.small, { marginTop: 4, marginBottom: space(5) }]}>We'll send a 6-digit OTP to your mobile number.</Text>

          <View style={[st.phoneBox, error ? { borderColor: colors.danger } : null]}>
            <Text style={st.cc}>+91</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              placeholder="Mobile number"
              placeholderTextColor={colors.textSubtle}
              keyboardType="number-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={10}
              style={st.phoneInput}
              accessibilityLabel="Mobile number"
              onSubmitEditing={() => valid && submit()}
            />
          </View>
          {error ? <Text style={ui.error}>{error}</Text> : null}

          <Button title="Get OTP" onPress={submit} disabled={!valid} loading={loading} style={{ marginTop: space(5) }} />

          <View style={{ flex: 1 }} />
          <View style={[ui.row, { justifyContent: 'center', marginTop: space(8), gap: space(5) }]}>
            <Pressable onPress={() => router.push('/symptom-checker')} style={ui.row}><Ionicons name="pulse-outline" size={16} color={colors.primary} /><Text style={st.link}> Symptom checker</Text></Pressable>
            <Pressable onPress={() => router.push('/about')} style={ui.row}><Ionicons name="call-outline" size={16} color={colors.primary} /><Text style={st.link}> Contact</Text></Pressable>
          </View>
          <Text style={[type.small, { textAlign: 'center', marginTop: space(5), fontSize: 12 }]}>
            By continuing you agree to our <Link href="/privacy" style={st.link}>Privacy Policy & Terms</Link>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: space(10) },
  logo: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  phoneBox: { flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 },
  cc: { fontSize: 16, fontWeight: '600', color: colors.text, paddingRight: 12, borderRightWidth: 1, borderColor: colors.border, marginRight: 12 },
  phoneInput: { flex: 1, fontSize: 18, letterSpacing: 1, color: colors.text, height: '100%' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
