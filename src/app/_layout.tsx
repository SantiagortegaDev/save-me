import { Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
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
import { maintainThumbnails } from '../lib/thumbnails';
import { checkForUpdates } from '../lib/updates';
import { maintainOfflineContent } from '../lib/offline';
import { DATABASE_NAME, migrate } from '../db/schema';
import { scheduleDailyReminder } from '../lib/reminders';
import { SettingsProvider, useSettings } from '../lib/settings';
import { ThemeProvider, useTheme } from '../lib/theme';
import { DialogHost } from '../lib/dialog';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url as never);
}

function AppShell() {
  const db = useSQLiteContext();
  const { ready, settings, update } = useSettings();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Claude (MCP) sync runs only when the user turned it on.
  useEffect(() => {
    void resumeMcpSync(db);
    return stopMcpSync;
  }, [db]);

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    void maintainThumbnails(db).then(() => maintainOfflineContent(db, { articles: settings.offlineText }));
    // Once per launch, after settings load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ready]);

  // Look for a newer GitHub release a moment after launch (throttled inside).
  useEffect(() => {
    if (!ready || !settings.onboarded) return;
    const timer = setTimeout(() => void checkForUpdates(update), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings.onboarded]);

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

  const scheme = useTheme();
  if (!ready) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="focus" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="share" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack>
      <DialogHost />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <SettingsProvider>
          <ThemeProvider>
            <AppShell />
          </ThemeProvider>
        </SettingsProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
