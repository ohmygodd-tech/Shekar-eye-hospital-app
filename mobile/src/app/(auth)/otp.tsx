import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Button, Notice, s as ui } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { colors, radius, space, type } from '@/lib/theme';

export default function Otp() {
  const { phone, devOtp } = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(30);
  const [hint, setHint] = useState(devOtp || '');
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(c = code) {
    if (c.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>('/auth/otp/verify', { body: { phone, code: c }, auth: false });
      await signIn(r.accessToken, r.refreshToken); // root layout routes to onboarding or home
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed');
      setCode('');
      input.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    try {
      const r = await api<{ devOtp?: string }>('/auth/otp/request', { body: { phone }, auth: false });
      setHint(r.devOtp || '');
      setWait(30);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resend OTP');
    }
  }

  const masked = phone ? `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}` : '';

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.white, padding: space(6) }}>
      <Text style={type.h1}>Enter OTP</Text>
      <Text style={[type.small, { marginTop: 6, marginBottom: space(6) }]}>Sent to {masked}</Text>

      {hint ? <Notice tone="warning">Development mode: your OTP is {hint}. (SMS is sent in production.)</Notice> : null}

      <Pressable onPress={() => input.current?.focus()} style={st.boxes} accessibilityLabel="OTP input">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[st.box, code.length === i && st.boxActive, error ? { borderColor: colors.danger } : null]}>
            <Text style={st.digit}>{code[i] || ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        autoFocus
        onChangeText={(t) => { const c = t.replace(/\D/g, '').slice(0, 6); setCode(c); setError(''); if (c.length === 6) verify(c); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        style={st.hidden}
      />
      {error ? <Text style={[ui.error, { textAlign: 'center' }]}>{error}</Text> : null}

      <Button title="Verify & continue" onPress={() => verify()} disabled={code.length !== 6} loading={loading} style={{ marginTop: space(6) }} />
      <View style={[ui.row, { justifyContent: 'center', marginTop: space(5) }]}>
        {wait > 0 ? <Text style={type.small}>Resend OTP in {wait}s</Text> : (
          <Pressable onPress={resend} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '600' }}>Resend OTP</Text></Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { width: 48, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.white },
  digit: { fontSize: 22, fontWeight: '700', color: colors.text },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
