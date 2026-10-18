import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'save-reminders';
const REMINDER_ID = 'saveme-daily-review';

export const DEFAULT_REMINDER_HOUR = 19;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Review reminders',
    description: 'A daily nudge to review saves you have not opened yet',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

// Re-scheduled on every app start so the body reflects the current backlog.
export async function scheduleDailyReminder(unseen: number, hour = DEFAULT_REMINDER_HOUR): Promise<void> {
  await cancelReminders();
  if (unseen <= 0) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Your saves are waiting',
      body:
        unseen === 1
          ? 'You have 1 save you have not opened yet. Take a minute in Focus Mode?'
          : `You have ${unseen} saves you have not opened yet. Take a minute in Focus Mode?`,
      data: { url: '/focus?scope=new' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL_ID },
  });
}

export async function sendTestReminder(): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'SaveMe reminder test', body: 'Reminders are working.', data: { url: '/focus?scope=new' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_ID },
  });
}
