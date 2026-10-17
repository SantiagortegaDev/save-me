import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { Label, Text } from '../components/ui';
import { exportAs, exportBackup, importBookmarks, isSaveMeBackup, restoreBackup } from '../lib/backup';
import { haptic } from '../lib/haptics';
import { colors, spacing } from '../theme';

async function pickTextFile(types: string[]): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const text = await new File(asset.uri).text();
  return { name: asset.name, text };
}

export default function BackupScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      Alert.alert(`${label} failed`, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const backup = (includeImages: boolean) =>
    run('Backup', async () => {
      const count = await exportBackup(db, { includeImages });
      if (count === 0) Alert.alert('Nothing to back up', 'Save something or create a collection first.');
    });

  const restore = () =>
    run('Restore', async () => {
      const file = await pickTextFile(['application/json', 'text/plain', '*/*']);
      if (!file) return;
      if (!isSaveMeBackup(file.text)) {
        Alert.alert('Not a SaveMe backup', 'To bring links from another app, use "Import from other apps" instead.');
        return;
      }
      const res = await restoreBackup(db, file.text);
      haptic.success();
      Alert.alert('Restore complete', `Added ${res.saves} saves and ${res.collections} collections. Items you already had were kept.`);
    });

  const importOther = () =>
    run('Import', async () => {
      const file = await pickTextFile(['text/csv', 'text/comma-separated-values', 'text/html', 'application/json', 'text/plain', '*/*']);
      if (!file) return;
      if (isSaveMeBackup(file.text)) {
        Alert.alert('This is a SaveMe backup', 'Use "Restore from backup" for this file.');
        return;
      }
      const res = await importBookmarks(db, file.name, file.text);
      haptic.success();
      Alert.alert(
        'Import complete',
        res.imported === 0
          ? 'No new links were imported because they are already in SaveMe.'
          : `Imported ${res.imported} links${res.skipped ? `, skipped ${res.skipped} duplicates` : ''}. Folders became collections.`,
      );
    });

  const exportOther = (format: 'csv' | 'html') =>
    run('Export', async () => {
      const count = await exportAs(db, format);
      if (count === 0) Alert.alert('Nothing to export', 'You have no saved links yet.');
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="Backup & import" right={busy ? <ActivityIndicator color={colors.ink} /> : null} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Label style={styles.label}>SaveMe backups</Label>
        <SettingsGroup>
          <SettingsRow icon="upload" iconColor={colors.accent} title="Export full backup" subtitle="Everything, including saved images (.json)" onPress={() => backup(true)} />
          <SettingsRow icon="file-text" iconColor={colors.accent} title="Export light backup" subtitle="Links, collections, tags and notes only" onPress={() => backup(false)} />
          <SettingsRow icon="download" iconColor={colors.accent} title="Restore from backup" subtitle="Merges a SaveMe .json backup into this library" onPress={restore} />
        </SettingsGroup>

        <Label style={styles.label}>Other apps & browsers</Label>
        <SettingsGroup>
          <SettingsRow
            icon="log-in"
            iconColor={colors.lilac}
            title="Import from other apps"
            subtitle="Pocket, Raindrop, Instapaper, Chrome, Firefox, Safari… (CSV, HTML or JSON)"
            onPress={importOther}
          />
          <SettingsRow icon="globe" iconColor={colors.lilac} title="Export as browser bookmarks" subtitle="Netscape HTML, importable by any browser" onPress={() => exportOther('html')} />
          <SettingsRow icon="grid" iconColor={colors.lilac} title="Export as spreadsheet" subtitle="CSV with url, title, collection, tags and notes" onPress={() => exportOther('csv')} />
        </SettingsGroup>

        <Text size="sm" color={colors.inkMuted} style={{ marginTop: spacing.lg }}>
          Backups are plain files you control. Save them to Google Drive, Files, email or anywhere else from the share menu.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
