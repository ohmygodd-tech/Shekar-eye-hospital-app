import React from 'react';
import { Linking, Text } from 'react-native';
import { Button, Card, Screen } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { space, type } from '@/lib/theme';

// Summary shown in-app. The full policy must be hosted at a public URL for the store listings
// (see docs/PRIVACY_POLICY.md) — set PRIVACY_URL below once published.
const PRIVACY_URL = '';

const SECTIONS: [string, string][] = [
  ['What we collect', 'Your mobile number, name, date of birth, gender, family members you add, medical history you share, appointment details, payment records (we never store card or UPI details — payments are processed by Razorpay), and reports uploaded by the hospital.'],
  ['Why we use it', 'To book and manage your appointments, maintain your medical records, process payments, send reminders and report alerts, and provide care. We do not sell your data or use it for advertising.'],
  ['Who can see it', 'Only you (and family members you manage) and authorised hospital staff involved in your care. Every access to records is logged.'],
  ['Security', 'Data is encrypted in transit (HTTPS) and stored on secured servers. Login uses one-time passwords; sessions are stored in your phone\'s secure storage.'],
  ['Your rights', 'You can view and correct your details in the app, withdraw consent, and delete your account from Profile → Delete account. Medical records are retained for the period required by Indian law.'],
  ['Symptom checker & assistant', 'These give general guidance only and are not a medical diagnosis. In an emergency, call the hospital immediately.'],
  ['Contact', 'For privacy questions or grievances, contact the hospital\'s grievance officer at the email below.'],
];

export default function Privacy() {
  const { hospital } = useSession();
  return (
    <Screen>
      <Text style={[type.h2, { marginBottom: space(4) }]}>Your privacy</Text>
      {SECTIONS.map(([h, b]) => (
        <Card key={h} style={{ marginBottom: space(3) }}>
          <Text style={[type.h3, { marginBottom: 4 }]}>{h}</Text>
          <Text style={type.small}>{b}</Text>
        </Card>
      ))}
      {hospital ? <Text style={[type.small, { marginBottom: space(4) }]}>Grievance contact: {hospital.email}</Text> : null}
      {PRIVACY_URL ? <Button title="Read full privacy policy" variant="outline" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
    </Screen>
  );
}
