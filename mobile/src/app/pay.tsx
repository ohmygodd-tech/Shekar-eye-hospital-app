// Payment screen. Uses Razorpay Standard Checkout inside a WebView (works on Android & iOS
// without extra native modules; UPI app links are handed to the OS). In dev, a mock gateway is used.
import React, { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Button, Loading, Notice, Screen } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';
import { rupees } from '@/lib/format';
import type { PaymentOrder } from '@/lib/types';

type Result = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

export default function Pay() {
  const { appointmentId, order: raw } = useLocalSearchParams<{ appointmentId: string; order: string }>();
  const order = useMemo(() => JSON.parse(raw) as PaymentOrder, [raw]);
  const { user } = useSession();
  const [state, setState] = useState<'checkout' | 'verifying' | 'failed'>('checkout');
  const [error, setError] = useState('');

  async function verify(orderId: string, paymentId: string, signature: string) {
    setState('verifying');
    try {
      await api('/appointments/payments/verify', { body: { orderId, paymentId, signature } });
      router.dismissAll();
      router.push({ pathname: '/appointment/[id]', params: { id: appointmentId, booked: '1' } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment could not be verified');
      setState('failed');
    }
  }

  async function mockPay() {
    const r = await api<{ orderId: string; paymentId: string; signature: string }>('/appointments/payments/mock-complete', { body: { orderId: order.orderId } });
    await verify(r.orderId, r.paymentId, r.signature);
  }

  async function retry() {
    setError('');
    try {
      const r = await api<{ payment: PaymentOrder }>(`/appointments/${appointmentId}/pay`, { method: 'POST', body: {} });
      router.setParams({ order: JSON.stringify(r.payment) });
      setState('checkout');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not restart payment');
    }
  }

  if (state === 'verifying') return <Loading label="Confirming your payment…" />;

  if (state === 'failed') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: space(8) }}>
          <Ionicons name="close-circle" size={64} color={colors.danger} />
          <Text style={[type.h2, { marginTop: space(3) }]}>Payment not completed</Text>
        </View>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Notice>Your slot is held for a few minutes. If money was deducted, it will be confirmed automatically or refunded in 5–7 working days.</Notice>
        <Button title="Try again" onPress={retry} />
        <Button title="View appointment" variant="outline" style={{ marginTop: space(3) }} onPress={() => { router.dismissAll(); router.push({ pathname: '/appointment/[id]', params: { id: appointmentId } }); }} />
      </Screen>
    );
  }

  if (order.provider === 'mock') {
    return (
      <Screen>
        <Notice tone="warning">Test mode — no real money is charged. Add Razorpay keys on the server to accept real payments.</Notice>
        <View style={{ alignItems: 'center', marginVertical: space(8) }}>
          <Text style={type.small}>Amount</Text>
          <Text style={[type.h1, { fontSize: 36 }]}>{rupees(order.amountPaise)}</Text>
          <Text style={type.small}>{order.name}</Text>
        </View>
        <Button title="Simulate successful payment" icon="checkmark-circle-outline" onPress={mockPay} />
        <Button title="Simulate failure" variant="danger" style={{ marginTop: space(3) }} onPress={() => { setError('Payment was cancelled.'); setState('failed'); }} />
      </Screen>
    );
  }

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body style="background:#F5F8FA">
<script>
  function send(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var rzp = new Razorpay({
    key: ${JSON.stringify(order.keyId)}, amount: ${order.amountPaise}, currency: 'INR', order_id: ${JSON.stringify(order.orderId)},
    name: ${JSON.stringify(order.name)}, description: 'Consultation fee',
    prefill: { contact: ${JSON.stringify(user?.phone ?? '')}, name: ${JSON.stringify(user?.name ?? '')}, email: ${JSON.stringify(user?.email ?? '')} },
    theme: { color: '${colors.primary}' },
    handler: function (r) { send({ type: 'success', data: r }); },
    modal: { ondismiss: function () { send({ type: 'dismiss' }); } }
  });
  rzp.on('payment.failed', function (r) { send({ type: 'failed', message: (r.error && r.error.description) || 'Payment failed' }); });
  rzp.open();
</script></body></html>`;

  function onMessage(e: WebViewMessageEvent) {
    const m = JSON.parse(e.nativeEvent.data) as { type: string; data?: Result; message?: string };
    if (m.type === 'success' && m.data) verify(m.data.razorpay_order_id, m.data.razorpay_payment_id, m.data.razorpay_signature);
    else if (m.type === 'failed') { setError(m.message || 'Payment failed'); setState('failed'); }
    else if (m.type === 'dismiss') { setError('Payment was cancelled.'); setState('failed'); }
  }

  return (
    <WebView
      source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
      onMessage={onMessage}
      originWhitelist={['*']}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      startInLoadingState
      renderLoading={() => <Loading label="Opening secure payment…" />}
      onShouldStartLoadWithRequest={(req) => {
        // Hand UPI / app intents (upi://, intent://, tez://, phonepe:// …) to the OS.
        if (/^(https?|about|data|blob):/i.test(req.url)) return true;
        Linking.openURL(req.url).catch(() => {});
        return false;
      }}
    />
  );
}
