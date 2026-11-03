import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { config } from '../config.js';

// "mock" provider is used automatically when Razorpay keys are not set (development / demo).
const MOCK_SECRET = 'mock-payment-secret';
let rzp = null;
if (config.payments.provider === 'razorpay') {
  rzp = new Razorpay({ key_id: config.payments.razorpayKeyId, key_secret: config.payments.razorpayKeySecret });
}

export const provider = () => config.payments.provider;
export const publicKey = () => (provider() === 'razorpay' ? config.payments.razorpayKeyId : 'mock');

export async function createOrder(amountPaise, receipt, notes) {
  if (rzp) {
    const order = await rzp.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
    return order.id;
  }
  return `mock_order_${crypto.randomBytes(8).toString('hex')}`;
}

function secret() {
  return provider() === 'razorpay' ? config.payments.razorpayKeySecret : MOCK_SECRET;
}

/** Razorpay checkout signature = HMAC_SHA256(order_id|payment_id, key_secret). */
export function signPayment(orderId, paymentId) {
  return crypto.createHmac('sha256', secret()).update(`${orderId}|${paymentId}`).digest('hex');
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = signPayment(orderId, paymentId);
  if (typeof signature !== 'string' || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyWebhook(rawBody, signature) {
  if (!config.payments.razorpayWebhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', config.payments.razorpayWebhookSecret).update(rawBody).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function refund(paymentId, amountPaise) {
  if (rzp && paymentId) await rzp.payments.refund(paymentId, { amount: amountPaise });
}
