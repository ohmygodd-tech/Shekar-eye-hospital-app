import { config } from '../config.js';
import { one, query } from '../db/index.js';

/** Save an in-app notification and send a push via Expo Push (works for Android FCM + iOS APNs). */
export async function notify(userId, title, body, data = {}) {
  await query('INSERT INTO notifications (user_id, title, body, data) VALUES ($1,$2,$3,$4)', [userId, title, body, data]);
  const u = await one('SELECT push_token FROM users WHERE id = $1', [userId]);
  if (!u?.push_token || config.isTest) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: u.push_token, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    console.error('push failed', e.message);
  }
}
