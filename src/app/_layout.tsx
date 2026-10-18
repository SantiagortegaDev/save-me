import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getStats } from '../db/repo';
import { resumeMcpSync, stopMcpSync } from '../lib/mcpSync';
import { DATABASE_NAME, migrate } from '../db/schema';
import { scheduleDailyReminder } from '../lib/reminders';
import { SettingsProvider, useSettings } from '../lib/settings';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url as never);
}

function AppShell() {
  const db = useSQLiteContext();
  const { ready, settings } = useSettings();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Claude (MCP) sync runs only when the user turned it on.
  useEffect(() => {
    void resumeMcpSync(db);
    return stopMcpSync;
  }, [db]);

  // Keep the daily reminder's text in sync with the current backlog.
  useEffect(() => {
    if (!ready || !settings.reminders) return;
    getStats(db)
      .then((s) => scheduleDailyReminder(s.unseen, settings.reminderHour))
      .catch((error) => console.warn('[reminders]', error));
  }, [db, ready, settings.reminders, settings.reminderHour]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    openFromNotification(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="focus" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="share" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <SettingsProvider>
          <AppShell />
        </SettingsProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
