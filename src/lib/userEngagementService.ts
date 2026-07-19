import { db } from './db';

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  action_tab: string | null;
  sender_name: string;
  read_at: string | null;
  created_at: string;
}

export async function trackUserEvent(userId: string, module: string, eventType = 'module_view', metadata: Record<string, unknown> = {}): Promise<void> {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `ferova.event.${userId}.${module}.${eventType}.${bucket}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  const { error } = await db('saas_user_events').insert({ user_id: userId, module, event_type: eventType, metadata });
  if (error) console.warn('[userEngagementService] trackUserEvent:', error.message);
}

export async function listMyNotifications(userId: string): Promise<UserNotification[]> {
  const { data, error } = await db<UserNotification>('user_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function sendUserNotification(userId: string, title: string, message: string, actionTab?: string): Promise<void> {
  const { error } = await db('user_notifications').insert({ user_id: userId, title, message, action_tab: actionTab || null, sender_name: 'María Fernanda' });
  if (error) throw error;
}
