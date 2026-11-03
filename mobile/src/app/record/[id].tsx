import React, { useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Badge, Button, Card, ErrorView, KeyValue, Loading, Screen, s } from '@/components/ui';
import { RECORD_META } from '@/components/recordMeta';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { colors, radius, space, type } from '@/lib/theme';
import { fmtDate, fmtDateTime, signed } from '@/lib/format';
import type { EyeSide, MedicalRecord } from '@/lib/types';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hospital } = useSession();
  const q = useApi<MedicalRecord>(`/records/${id}`, { refetchOnFocus: false });
  const [busy, setBusy] = useState(false);

  if (q.loading) return <Loading />;
  if (q.error || !q.data) return <ErrorView message={q.error || 'Not found'} onRetry={q.refresh} />;
  const r = q.data;
  const d = r.data || {};
  const hasRx = !!(d.od || d.os);

  async function openFile() {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/links/records/${r.id}`);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert('Could not open file', e instanceof Error ? e.message : '');
    } finally { setBusy(false); }
  }

  async function sharePdf() {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: recordHtml(r, hospital?.name ?? 'Shekar Eye Hospital') });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: r.title, UTI: 'com.adobe.pdf' });
    } catch { /* user cancelled */ } finally { setBusy(false); }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: RECORD_META[r.type].label }} />
      <Card>
        <Badge label={RECORD_META[r.type].label} tone="info" />
        <Text style={[type.h2, { marginTop: space(2) }]}>{r.title}</Text>
        <Text style={type.small}>{r.patient.name} · {r.patient.mrn}</Text>
        <Text style={type.small}>{fmtDateTime(r.createdAt)}{r.uploadedBy ? ` · by ${r.uploadedBy}` : ''}</Text>
      </Card>

      {hasRx && (
        <Card style={{ marginTop: space(3) }}>
          <Text style={[type.h3, { marginBottom: space(3) }]}>{r.type === 'spectacle_rx' ? 'Glasses power' : 'Eye measurements'}</Text>
          <View style={st.table}>
            <View style={[st.tr, st.th]}>
              {['Eye', 'SPH', 'CYL', 'AXIS', 'ADD', 'VA'].map((h) => <Text key={h} style={[st.cell, st.thText]}>{h}</Text>)}
            </View>
            <RxRow label="Right (OD)" e={d.od} />
            <RxRow label="Left (OS)" e={d.os} last />
          </View>
          {(d.od?.iop || d.os?.iop) ? <KeyValue k="Eye pressure (IOP)" v={`R ${d.od?.iop ?? '—'} / L ${d.os?.iop ?? '—'} mmHg`} /> : null}
          {d.pd ? <KeyValue k="Pupillary distance (PD)" v={`${d.pd} mm`} /> : null}
        </Card>
      )}

      {d.diagnosis ? <Card style={{ marginTop: space(3) }}><Text style={type.tiny}>DIAGNOSIS</Text><Text style={[type.body, { marginTop: 4 }]}>{d.diagnosis}</Text></Card> : null}

      {d.medicines?.length ? (
        <Card style={{ marginTop: space(3) }}>
          <Text style={[type.h3, { marginBottom: space(2) }]}>Medicines</Text>
          {d.medicines.map((m, i) => (
            <View key={i} style={[st.med, i === d.medicines!.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={[type.body, { fontWeight: '600' }]}>{m.name}{m.eye ? ` · ${m.eye === 'both' ? 'both eyes' : `${m.eye} eye`}` : ''}</Text>
              <Text style={type.small}>{[m.dose, m.frequency, m.duration].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {r.notes ? <Card style={{ marginTop: space(3) }}><Text style={type.tiny}>DOCTOR'S NOTES</Text><Text style={[type.body, { marginTop: 4 }]}>{r.notes}</Text></Card> : null}
      {d.followUpDate ? <Card style={{ marginTop: space(3), backgroundColor: colors.secondarySoft }}><Text style={[type.body, { fontWeight: '600' }]}>Follow-up on {fmtDate(d.followUpDate, { weekday: true, year: true })}</Text></Card> : null}

      <View style={{ gap: space(3), marginTop: space(5) }}>
        {r.hasFile && <Button title={`Open ${r.mimeType === 'application/pdf' ? 'PDF' : 'image'}`} icon="open-outline" onPress={openFile} loading={busy} />}
        {(hasRx || d.medicines?.length || r.notes) ? <Button title="Share as PDF" icon="share-outline" variant="outline" onPress={sharePdf} loading={busy} /> : null}
      </View>
    </Screen>
  );
}

function RxRow({ label, e, last }: { label: string; e?: EyeSide; last?: boolean }) {
  return (
    <View style={[st.tr, last && { borderBottomWidth: 0 }]}>
      <Text style={[st.cell, { fontWeight: '600', fontSize: 11.5 }]}>{label}</Text>
      <Text style={st.cell}>{signed(e?.sph)}</Text>
      <Text style={st.cell}>{e?.cyl !== undefined ? signed(e.cyl) : '—'}</Text>
      <Text style={st.cell}>{e?.axis ?? '—'}</Text>
      <Text style={st.cell}>{e?.add !== undefined ? signed(e.add) : '—'}</Text>
      <Text style={st.cell}>{e?.va ?? '—'}</Text>
    </View>
  );
}

const esc = (x: unknown) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function recordHtml(r: MedicalRecord, hospitalName: string) {
  const d = r.data || {};
  const row = (l: string, e?: EyeSide) => `<tr><td><b>${l}</b></td><td>${signed(e?.sph)}</td><td>${e?.cyl !== undefined ? signed(e.cyl) : '—'}</td><td>${e?.axis ?? '—'}</td><td>${e?.add !== undefined ? signed(e.add) : '—'}</td><td>${esc(e?.va ?? '—')}</td></tr>`;
  return `<html><body style="font-family:Helvetica;padding:24px;color:#101828">
  <h2 style="color:${colors.primary};margin:0">${esc(hospitalName)}</h2><hr/>
  <h3>${esc(r.title)}</h3><p>${esc(r.patient.name)} (${esc(r.patient.mrn)}) · ${esc(fmtDateTime(r.createdAt))}</p>
  ${d.od || d.os ? `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;text-align:center"><tr style="background:#E6F3F8"><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>VA</th></tr>${row('Right (OD)', d.od)}${row('Left (OS)', d.os)}</table>${d.pd ? `<p>PD: ${d.pd} mm</p>` : ''}` : ''}
  ${d.diagnosis ? `<p><b>Diagnosis:</b> ${esc(d.diagnosis)}</p>` : ''}
  ${d.medicines?.length ? `<h4>Medicines</h4><ul>${d.medicines.map((m) => `<li>${esc(m.name)} ${esc(m.eye ?? '')} — ${esc([m.dose, m.frequency, m.duration].filter(Boolean).join(', '))}</li>`).join('')}</ul>` : ''}
  ${r.notes ? `<p><b>Notes:</b> ${esc(r.notes)}</p>` : ''}
  ${d.followUpDate ? `<p><b>Follow-up:</b> ${esc(d.followUpDate)}</p>` : ''}
  </body></html>`;
}

const st = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', marginBottom: space(2) },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 10 },
  th: { backgroundColor: colors.primarySoft },
  thText: { fontWeight: '700', color: colors.primaryDark, fontSize: 11.5 },
  cell: { flex: 1, textAlign: 'center', fontSize: 13.5, color: colors.text },
  med: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
