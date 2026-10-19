import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '../components/Logo';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { Card, Icon, Label, Text } from '../components/ui';
import { getStats, wipeLibrary } from '../db/repo';
import { deleteAllImages } from '../lib/images';
import { cancelReminders, requestReminderPermission, scheduleDailyReminder, sendTestReminder } from '../lib/reminders';
import { useSettings } from '../lib/settings';
import { appVersion, checkForUpdates, subscribeUpdateProgress, type UpdateProgress } from '../lib/updates';
import { colors, spacing, themed } from '../theme';
import { useTheme } from '../lib/theme';
import { Alert } from '../lib/dialog';

const REPO_URL = 'https://github.com/santiagortegadev/save-me';
const REMINDER_HOURS = [8, 12, 19, 21];

export default function SettingsScreen() {
  useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const [checking, setChecking] = useState(false);
  const [download, setDownload] = useState<UpdateProgress>(null);
  useEffect(() => subscribeUpdateProgress(setDownload), []);

  async function checkNow() {
    if (checking || download) return;
    setChecking(true);
    await checkForUpdates(update, true);
    setChecking(false);
  }

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
        <Card color={colors.primary} style={styles.plan}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text size="xxs" weight="heavy" style={{ letterSpacing: 1 }} color={colors.ink}>
              YOUR PLAN
            </Text>
            <Text weight="heavy" size="xl" color={colors.ink}>
              SaveMe Free
            </Text>
            <Text size="xs" color={colors.ink}>
              Every feature unlocked. Open source, no account, no ads, no tracking.
            </Text>
            <View style={styles.planBadge}>
              <Text size="xxs" weight="heavy">
                ∞ EVERYTHING INCLUDED
              </Text>
            </View>
          </View>
          <View style={styles.planLogo}>
            <Logo size={76} />
          </View>
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
            icon="moon"
            iconColor={colors.lilac}
            title="Appearance"
            subtitle={settings.theme === 'system' ? 'Follows your phone' : settings.theme === 'dark' ? 'Always dark' : 'Always light'}
            right={
              <View style={styles.segment}>
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityLabel={`Theme ${mode}`}
                    accessibilityState={{ selected: settings.theme === mode }}
                    onPress={() => update({ theme: mode })}
                    style={[styles.segmentItem, settings.theme === mode && styles.segmentOn]}
                  >
                    <Icon
                      name={mode === 'system' ? 'smartphone' : mode === 'light' ? 'sun' : 'moon'}
                      size={14}
                      color={settings.theme === mode ? colors.paper : colors.text}
                    />
                  </Pressable>
                ))}
              </View>
            }
          />
          <SettingsRow
            icon="image"
            iconColor={colors.accent}
            title="Image previews"
            subtitle={settings.imageFit === 'fit' ? 'Fit: cards take each image’s shape, nothing is cropped' : 'Fill: images cover the card, edges may be cropped'}
            right={
              <View style={styles.segment}>
                {(['fill', 'fit'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected: settings.imageFit === mode }}
                    onPress={() => update({ imageFit: mode })}
                    style={[styles.segmentItem, settings.imageFit === mode && styles.segmentOn]}
                  >
                    <Text size="xs" weight="bold" color={settings.imageFit === mode ? colors.paper : colors.text}>
                      {mode === 'fill' ? 'Fill' : 'Fit'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />
          <SettingsRow
            icon="book-open"
            iconColor={colors.info}
            title="Save text for offline reading"
            subtitle="Keeps a readable copy of articles you save"
            toggle={{ value: settings.offlineText, onChange: (v) => update({ offlineText: v }) }}
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

        <Label style={styles.label}>Claude</Label>
        <SettingsGroup>
          <SettingsRow
            icon="cpu"
            iconColor={colors.lilac}
            title="Claude (MCP)"
            subtitle="Let Claude search and organize your library"
            onPress={() => router.push('/claude')}
          />
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
          {Platform.OS !== 'web' ? (
            <SettingsRow
              icon="download"
              iconColor={colors.accent}
              title="Check for updates"
              subtitle={
                download
                  ? `Downloading ${download.version}${download.fraction !== null ? ` · ${Math.round(download.fraction * 100)}%` : '…'}`
                  : checking
                    ? 'Checking…'
                    : `You have version ${appVersion()}`
              }
              onPress={checkNow}
            />
          ) : null}
          <SettingsRow icon="github" iconColor={colors.info} title="Source code" subtitle="Report bugs, suggest features, contribute" onPress={() => WebBrowser.openBrowserAsync(REPO_URL)} />
        </SettingsGroup>

        <Text size="xs" color={colors.inkMuted} style={styles.footer}>
          SaveMe {appVersion()} · MIT License · Your data stays on your device unless you export it or connect Claude.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
    plan: { padding: spacing.md, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    planLogo: { transform: [{ rotate: '8deg' }] },
    planBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1.5,
      borderColor: colors.ink,
      borderRadius: 4,
      backgroundColor: colors.surface,
    },
    label: { marginTop: spacing.lg, marginBottom: spacing.sm },
    footer: { textAlign: 'center', marginTop: spacing.xl },
    segment: { flexDirection: 'row', borderWidth: 2, borderColor: colors.ink, borderRadius: 8, overflow: 'hidden' },
    segmentItem: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
    segmentOn: { backgroundColor: colors.text },
  }),
);
