import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

/** Opens the right screen when the user taps a push notification (phones only). */
export function NotificationRouter({ enabled }: { enabled: boolean }) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!enabled || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = last.notification.request.content.data as { type?: string; id?: string };
    if (data?.type === 'appointment' && data.id) router.push({ pathname: '/appointment/[id]', params: { id: data.id } });
    if (data?.type === 'record' && data.id) router.push({ pathname: '/record/[id]', params: { id: data.id } });
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [last, enabled]);
  return null;
}
