import React from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, KeyValue, Loading, Screen, s } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';

export default function About() {
  const { hospital: h } = useSession();
  if (!h) return <Loading />;
  const tel = (n: string) => Linking.openURL(`tel:${n.replace(/[^\d+]/g, '')}`);
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginVertical: space(4) }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="eye" size={36} color={colors.white} />
        </View>
        <Text style={[type.h2, { marginTop: space(3) }]}>{h.name}</Text>
        <Text style={type.small}>{h.tagline}</Text>
      </View>

      <Card>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text style={[type.body, { flex: 1, marginLeft: 10 }]}>{h.address}</Text>
        </View>
      </Card>

      <Card style={{ marginTop: space(3) }}>
        <Text style={[type.h3, { marginBottom: 4 }]}>OPD timings</Text>
        {h.timings.map((t) => <KeyValue key={t.days} k={t.days} v={t.hours} />)}
      </Card>

      <Card style={{ marginTop: space(3) }}>
        <Text style={[type.h3, { marginBottom: 4 }]}>Insurance</Text>
        <Text style={type.small}>{h.insurance}</Text>
      </Card>

      <View style={{ gap: space(3), marginTop: space(5) }}>
        <Button title={`Call reception · ${h.phone}`} icon="call-outline" onPress={() => tel(h.phone)} />
        <Button title={`Eye emergency · ${h.emergencyPhone}`} icon="medkit-outline" variant="danger" onPress={() => tel(h.emergencyPhone)} />
        {h.whatsapp ? <Button title="WhatsApp us" icon="logo-whatsapp" variant="outline" onPress={() => Linking.openURL(`https://wa.me/${h.whatsapp.replace(/\D/g, '')}`)} /> : null}
        {h.mapsUrl ? <Button title="Get directions" icon="navigate-outline" variant="outline" onPress={() => Linking.openURL(h.mapsUrl)} /> : null}
        <Button title={`Email · ${h.email}`} icon="mail-outline" variant="outline" onPress={() => Linking.openURL(`mailto:${h.email}`)} />
        {h.website ? <Button title="Visit website" icon="globe-outline" variant="ghost" onPress={() => Linking.openURL(h.website)} /> : null}
      </View>
    </Screen>
  );
}
