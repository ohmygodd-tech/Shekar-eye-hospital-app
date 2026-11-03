import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Field, Notice, s } from './ui';
import { colors, space, type } from '@/lib/theme';
import type { Patient } from '@/lib/types';

export type PatientInput = {
  name: string; relation: string; dob: string | null; gender: string | null; bloodGroup: string | null;
  allergies: string | null; medicalHistory: string | null; wearsGlasses: boolean | null;
};

const RELATIONS = ['spouse', 'child', 'parent', 'sibling', 'other'];
const CONDITIONS = ['Diabetes', 'High BP', 'Thyroid', 'Asthma', 'Heart disease', 'Previous eye surgery', 'Glaucoma in family'];

const toDisplay = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
function toIso(d: string): string | null | 'invalid' {
  if (!d.trim()) return null;
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 'invalid';
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso || dt > new Date() || Number(m[3]) < 1900) return 'invalid';
  return iso;
}

export function PatientForm({ initial, self, submitLabel, onSubmit, consent }: {
  initial?: Partial<Patient>; self?: boolean; submitLabel: string; consent?: boolean;
  onSubmit: (p: PatientInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [relation, setRelation] = useState(initial?.relation ?? (self ? 'self' : 'child'));
  const [dob, setDob] = useState(toDisplay(initial?.dob ?? null));
  const [gender, setGender] = useState<string | null>(initial?.gender ?? null);
  const [history, setHistory] = useState<string[]>(initial?.medicalHistory ? initial.medicalHistory.split(', ').filter(Boolean) : []);
  const [allergies, setAllergies] = useState(initial?.allergies ?? '');
  const [glasses, setGlasses] = useState<boolean>(!!initial?.wearsGlasses);
  const [agreed, setAgreed] = useState(!consent);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Please enter the full name';
    const iso = toIso(dob);
    if (iso === 'invalid') e.dob = 'Use DD/MM/YYYY, e.g. 15/08/1985';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setFormError('');
    try {
      await onSubmit({
        name: name.trim(), relation, dob: iso as string | null, gender, bloodGroup: null,
        allergies: allergies.trim() || null, medicalHistory: history.length ? history.join(', ') : null, wearsGlasses: glasses,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Field label="Full name" value={name} onChangeText={setName} placeholder="As on ID proof" autoCapitalize="words" error={errors.name} autoComplete="name" />
      {!self && !initial?.id && (
        <View style={{ marginBottom: space(4) }}>
          <Text style={s.label}>Relation</Text>
          <View style={[s.row, { flexWrap: 'wrap', rowGap: 8 }]}>
            {RELATIONS.map((r) => <Chip key={r} label={r[0].toUpperCase() + r.slice(1)} selected={relation === r} onPress={() => setRelation(r)} />)}
          </View>
        </View>
      )}
      <Field label="Date of birth" value={dob} onChangeText={(t) => setDob(t.replace(/[^\d/]/g, '').slice(0, 10))} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" error={errors.dob} />
      <View style={{ marginBottom: space(4) }}>
        <Text style={s.label}>Gender</Text>
        <View style={s.row}>
          {['male', 'female', 'other'].map((g) => <Chip key={g} label={g[0].toUpperCase() + g.slice(1)} selected={gender === g} onPress={() => setGender(g)} />)}
        </View>
      </View>
      <View style={{ marginBottom: space(4) }}>
        <Text style={s.label}>Medical history (helps your eye doctor)</Text>
        <View style={[s.row, { flexWrap: 'wrap', rowGap: 8 }]}>
          {CONDITIONS.map((c) => (
            <Chip key={c} label={c} selected={history.includes(c)} onPress={() => setHistory((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
          ))}
        </View>
      </View>
      <Field label="Allergies (medicines, eye drops)" value={allergies} onChangeText={setAllergies} placeholder="e.g. Penicillin — leave blank if none" />
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: space(5) }]}>
        <Text style={type.body}>Wears glasses or contact lenses</Text>
        <Switch value={glasses} onValueChange={setGlasses} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>

      {consent && (
        <Pressable onPress={() => setAgreed(!agreed)} style={[s.row, { alignItems: 'flex-start', marginBottom: space(5) }]} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
          <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.primary : colors.textSubtle} />
          <Text style={[type.small, { flex: 1, marginLeft: 10 }]}>
            I consent to Shekar Eye Hospital storing and processing my and my family's health information to provide care, as described in the Privacy Policy.
          </Text>
        </Pressable>
      )}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Button title={submitLabel} onPress={submit} loading={saving} disabled={!agreed} />
    </View>
  );
}
