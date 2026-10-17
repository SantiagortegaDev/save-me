import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { Card, Label, Text } from '../components/ui';
import { getStats, wipeLibrary } from '../db/repo';
import { deleteAllImages } from '../lib/images';
import { cancelReminders, requestReminderPermission, scheduleDailyReminder, sendTestReminder } from '../lib/reminders';
import { useSettings } from '../lib/settings';
import { brutal, colors, spacing } from '../theme';

const REPO_URL = 'https://github.com/santiagortegadev/save-me';
const REMINDER_HOURS = [8, 12, 19, 21];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();

  async function toggleReminders(on: boolean) {
    if (on) {
      const granted = await requestReminderPermission();
      if (!granted) {
        Alert.alert('Notifications are off', 'Allow notifications for SaveMe in system settings to get review reminders.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const stats = await getStats(db);
      await scheduleDailyReminder(stats.unseen, settings.reminderHour);
    } else {
      await cancelReminders();
    }
    await update({ reminders: on });
  }

  function pickHour() {
    Alert.alert(
      'Reminder time',
      'When should SaveMe nudge you?',
      [
        ...REMINDER_HOURS.map((h) => ({
          text: `${String(h).padStart(2, '0')}:00`,
          onPress: () => update({ reminderHour: h }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  function deleteEverything() {
    Alert.alert('Delete all data?', 'This permanently erases every save, collection and tag on this device. Export a backup first if you want to keep them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          await wipeLibrary(db);
          deleteAllImages();
          await cancelReminders();
          Alert.alert('Data deleted', 'Your library is empty now.');
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Card color={colors.accent} style={styles.plan}>
          <Text weight="bold" size="lg">
            Everything unlocked 🎉
          </Text>
          <Text size="sm">
            SaveMe is free and open source. Unlimited saves, images, collections, sub-collections, tags, Focus Mode, reminders,
            import and export — no account, no ads, no tracking.
          </Text>
        </Card>

        <Label style={styles.label}>Preferences</Label>
        <SettingsGroup>
          <SettingsRow
            icon="smartphone"
            title="Haptic feedback"
            subtitle="Vibrate on taps and selections"
            toggle={{ value: settings.haptics, onChange: (v) => update({ haptics: v }) }}
          />
          <SettingsRow
            icon="bell"
            iconColor={colors.peach}
            title="Review reminders"
            subtitle="A daily nudge when saves are waiting"
            toggle={{ value: settings.reminders, onChange: toggleReminders }}
          />
          {settings.reminders ? (
            <>
              <SettingsRow
                icon="clock"
                iconColor={colors.peach}
                title="Reminder time"
                onPress={pickHour}
                right={<Text weight="bold">{String(settings.reminderHour).padStart(2, '0')}:00</Text>}
              />
              <SettingsRow icon="send" iconColor={colors.peach} title="Send a test reminder" onPress={() => sendTestReminder()} />
            </>
          ) : null}
        </SettingsGroup>

        <Label style={styles.label}>Data & storage</Label>
        <SettingsGroup>
          <SettingsRow
            icon="download-cloud"
            iconColor={colors.lilac}
            title="Backup, restore & import"
            subtitle="Local backups, CSV / HTML / JSON import and export"
            onPress={() => router.push('/backup')}
          />
          <SettingsRow icon="trash-2" danger title="Delete all data" subtitle="Erase every save, collection and tag" onPress={deleteEverything} />
        </SettingsGroup>

        <Label style={styles.label}>Help</Label>
        <SettingsGroup>
          <SettingsRow icon="share" iconColor={colors.info} title="Save from any app" subtitle="How to use the share menu" onPress={() => router.push('/how-to')} />
          <SettingsRow icon="play-circle" iconColor={colors.info} title="Replay intro" onPress={() => router.push('/onboarding')} />
          <SettingsRow icon="github" iconColor={colors.info} title="Source code" subtitle="Report bugs, suggest features, contribute" onPress={() => WebBrowser.openBrowserAsync(REPO_URL)} />
        </SettingsGroup>

        <Text size="xs" color={colors.inkMuted} style={styles.footer}>
          SaveMe {Constants.expoConfig?.version ?? ''} · MIT License · Your data never leaves your device unless you export it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  plan: { padding: spacing.md, gap: spacing.xs, marginTop: spacing.xs, ...brutal.shadow },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  footer: { textAlign: 'center', marginTop: spacing.xl },
});
