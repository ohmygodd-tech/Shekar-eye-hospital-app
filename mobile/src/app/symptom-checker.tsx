import React, { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Field, Notice, Screen, s } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';
import type { TriageResult } from '@/lib/types';

const QUICK = ['Blurred vision', 'Red eye', 'Itching / watering', 'Floaters or flashes', 'Eye pain', 'Need new glasses', 'Child squinting', 'Swelling on eyelid'];
const DURATIONS = [{ l: 'Today', d: 0 }, { l: '< 1 week', d: 3 }, { l: '1–4 weeks', d: 14 }, { l: '> 1 month', d: 45 }];

export default function SymptomChecker() {
  const { user, hospital } = useSession();
  const [text, setText] = useState('');
  const [age, setAge] = useState('');
  const [duration, setDuration] = useState<number | undefined>();
  const [diabetic, setDiabetic] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function check() {
    setError('');
    setLoading(true);
    try {
      setResult(await api<TriageResult>('/ai/triage', {
        body: { symptoms: text, age: age ? Number(age) : undefined, durationDays: duration, diabetic }, auth: false,
      }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check symptoms');
    } finally { setLoading(false); }
  }

  if (result) {
    const tone = result.urgency === 'emergency' ? 'danger' : result.urgency === 'soon' ? 'warning' : 'success';
    const color = { danger: colors.danger, warning: colors.warning, success: colors.success }[tone];
    const bg = { danger: colors.dangerSoft, warning: colors.warningSoft, success: colors.successSoft }[tone];
    return (
      <Screen>
        <Card style={{ backgroundColor: bg, shadowOpacity: 0, elevation: 0 }}>
          <Ionicons name={result.urgency === 'emergency' ? 'warning' : result.urgency === 'soon' ? 'time' : 'checkmark-circle'} size={32} color={color} />
          <Text style={[type.h2, { color, marginTop: 8 }]}>{result.title}</Text>
          {result.advice.map((a) => <Text key={a} style={[type.body, { marginTop: 8 }]}>• {a}</Text>)}
        </Card>

        {result.urgency === 'emergency' ? (
          <Button title={`Call emergency ${result.emergencyPhone}`} icon="call" style={{ marginTop: space(5), backgroundColor: colors.danger, borderColor: colors.danger }}
            onPress={() => Linking.openURL(`tel:${result.emergencyPhone.replace(/[^\d+]/g, '')}`)} />
        ) : result.departmentInfo ? (
          <Card style={{ marginTop: space(4) }}>
            <Text style={type.tiny}>SUGGESTED SPECIALITY</Text>
            <Text style={[type.h3, { marginTop: 4, marginBottom: space(4) }]}>{result.departmentInfo.name}</Text>
            <Button title="See doctors & book" onPress={() => (user
              ? router.push({ pathname: '/doctors', params: { department: result.departmentInfo!.slug, name: result.departmentInfo!.name } })
              : router.back())} />
          </Card>
        ) : null}

        <Notice tone="info">{result.disclaimer}</Notice>
        <Button title="Check other symptoms" variant="outline" onPress={() => setResult(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice icon="sparkles-outline">Describe what you're experiencing and we'll suggest how urgent it is and which eye specialist to see.</Notice>
      <Text style={s.label}>Common symptoms</Text>
      <View style={[s.row, { flexWrap: 'wrap', rowGap: 8, marginBottom: space(4) }]}>
        {QUICK.map((q) => <Chip key={q} label={q} selected={text.toLowerCase().includes(q.toLowerCase())}
          onPress={() => setText((t) => (t.toLowerCase().includes(q.toLowerCase()) ? t : `${t}${t ? ', ' : ''}${q.toLowerCase()}`))} />)}
      </View>
      <Field label="Describe your symptoms" value={text} onChangeText={setText} multiline placeholder="e.g. My right eye has been red and painful since yesterday, and light hurts" maxLength={1000} />
      <Text style={s.label}>How long?</Text>
      <View style={[s.row, { marginBottom: space(4), flexWrap: 'wrap', rowGap: 8 }]}>
        {DURATIONS.map((d) => <Chip key={d.l} label={d.l} selected={duration === d.d} onPress={() => setDuration(d.d)} />)}
      </View>
      <Field label="Age of the patient" value={age} onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="e.g. 54" />
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: space(5) }]}>
        <Text style={type.body}>Has diabetes</Text>
        <Switch value={diabetic} onValueChange={setDiabetic} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button title="Check" icon="pulse" onPress={check} loading={loading} disabled={text.trim().length < 3} />
      {hospital && <Text style={[type.small, { textAlign: 'center', marginTop: space(5) }]}>In an emergency call {hospital.emergencyPhone}</Text>}
    </Screen>
  );
}
