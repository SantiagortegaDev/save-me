import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { Button, Card, Chip, Label, Text } from '../components/ui';
import { confirm } from '../lib/confirm';
import { haptic } from '../lib/haptics';
import {
  connectorUrl,
  disableMcp,
  enableMcp,
  loadMcpState,
  regenerateMcpToken,
  setMcpPermission,
  subscribeMcpState,
  syncNow,
  type McpState,
} from '../lib/mcpSync';
import type { Permission } from '../shared/sync';
import { brutal, colors, radius, spacing } from '../theme';

function mask(url: string): string {
  const cut = url.lastIndexOf('.');
  return `${url.slice(0, cut + 5)}••••••••••••`;
}

function ago(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ts).toLocaleString();
}

const STEPS_APP = [
  'In Claude (web, desktop or mobile) open Settings → Connectors.',
  'Tap "Add custom connector", name it SaveMe and paste your link as the URL.',
  'Start a chat and ask things like "What did I save about Japan?" or "Sort my Inbox into collections".',
];

export default function ClaudeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<McpState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    loadMcpState(db).then(setState).catch(() => setState(null));
    return subscribeMcpState(setState);
  }, [db]);

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert('Could not reach the SaveMe server', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(on: boolean) {
    if (on) {
      const ok = await confirm(
        'Connect SaveMe to Claude?',
        'A copy of your links, collections, tags and notes (not your images) will be kept on mcp-saveme.santiagortega.dev so Claude can read it with your private link. Turning this off deletes that copy.',
        'Connect',
      );
      if (ok) await run(() => enableMcp(db, 'read').then(() => haptic.success()));
    } else {
      const ok = await confirm(
        'Disconnect Claude?',
        'Your link stops working and the copy on the server is deleted. Your library on this phone is not touched.',
        'Disconnect',
        true,
      );
      if (ok) await run(() => disableMcp(db));
    }
  }

  async function regenerate() {
    const ok = await confirm('Regenerate link?', 'The current link stops working right away. You will need to paste the new one into Claude.', 'Regenerate', true);
    if (!ok) return;
    await run(async () => {
      await regenerateMcpToken(db);
      setReveal(true);
      haptic.success();
    });
  }

  async function copy(url: string) {
    await Clipboard.setStringAsync(url);
    haptic.success();
    Alert.alert('Link copied', 'Paste it into Claude as a custom connector. Keep it private: anyone with this link can see your library.');
  }

  const enabled = !!state?.enabled;
  const url = state ? connectorUrl(state) : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="Claude (MCP)" right={busy ? <ActivityIndicator color={colors.ink} /> : null} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Card color={colors.lilac} style={styles.hero}>
          <Text weight="bold" size="lg">
            Talk to your library with Claude
          </Text>
          <Text size="sm">
            Let Claude search your saves, summarize what you collected and — if you allow it — tidy up collections, tags and pins for you.
          </Text>
        </Card>

        <SettingsGroup>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">Connect to Claude</Text>
              <Text size="sm" color={colors.inkMuted}>
                {enabled ? `Last sync ${ago(state?.lastSyncAt ?? null)}` : 'Off. Nothing leaves your phone.'}
              </Text>
            </View>
            <Switch
              value={enabled}
              disabled={busy || state === undefined}
              onValueChange={toggle}
              trackColor={{ true: colors.ink, false: '#D6D6D6' }}
              thumbColor={colors.white}
            />
          </View>
        </SettingsGroup>

        {enabled && state ? (
          <>
            {state.lastError ? (
              <Text size="sm" color={colors.danger} weight="semibold" style={{ marginTop: spacing.sm }}>
                Sync problem: {state.lastError}
              </Text>
            ) : null}

            <Label style={styles.label}>What Claude can do</Label>
            <View style={styles.chips}>
              {(['read', 'edit'] as Permission[]).map((p) => (
                <Chip
                  key={p}
                  label={p === 'read' ? 'View only' : 'View & edit'}
                  icon={p === 'read' ? 'eye' : 'edit-3'}
                  color={colors.accent}
                  active={state.permission === p}
                  onPress={() => state.permission !== p && run(() => setMcpPermission(db, p))}
                />
              ))}
            </View>
            <Text size="sm" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
              {state.permission === 'read'
                ? 'Claude can browse and search your collections, saves, tags and notes.'
                : 'Claude can also save links, move saves, create, rename and nest collections, edit notes, tags and pins, and delete. Changes appear here next time you open the app.'}
            </Text>

            <Label style={styles.label}>Your private link</Label>
            <View style={[styles.urlBox, brutal.shadowSmall]}>
              <Text size="sm" weight="medium" selectable numberOfLines={3}>
                {reveal ? url : mask(url)}
              </Text>
            </View>
            <View style={styles.row}>
              <Button title="Copy link" icon="copy" style={{ flex: 1 }} onPress={() => copy(url)} />
              <Button icon={reveal ? 'eye-off' : 'eye'} variant="plain" accessibilityLabel={reveal ? 'Hide link' : 'Show link'} onPress={() => setReveal(!reveal)} />
              <Button icon="share-2" variant="plain" accessibilityLabel="Share link" onPress={() => Share.share({ message: url })} />
            </View>

            <Label style={styles.label}>Add it to Claude</Label>
            {STEPS_APP.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.num}>
                  <Text weight="bold" size="sm">
                    {i + 1}
                  </Text>
                </View>
                <Text size="sm" style={{ flex: 1 }}>
                  {step}
                </Text>
              </View>
            ))}
            <Text size="sm" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
              Claude Code:
            </Text>
            <View style={styles.code}>
              <Text size="xs" selectable style={{ fontFamily: 'monospace' }}>
                claude mcp add --transport http saveme {reveal ? url : '<your link>'}
              </Text>
            </View>

            <Label style={styles.label}>Manage</Label>
            <SettingsGroup>
              <SettingsRow icon="refresh-cw" iconColor={colors.accent} title="Sync now" subtitle="Upload changes and apply Claude’s edits" onPress={() => run(() => syncNow(db))} />
              <SettingsRow icon="key" iconColor={colors.peach} title="Regenerate link" subtitle="Revoke the current link and create a new one" onPress={regenerate} />
            </SettingsGroup>
          </>
        ) : null}

        <Text size="xs" color={colors.inkMuted} style={styles.footer}>
          No account needed: your private link is the key. Images stay on your phone. The server is open source in this app’s repository.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center', gap: spacing.sm },
  hero: { padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  label: { marginTop: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm },
  urlBox: {
    backgroundColor: colors.white,
    borderWidth: brutal.border,
    borderColor: colors.ink,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: brutal.borderThin,
    borderColor: colors.ink,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { backgroundColor: colors.white, borderWidth: brutal.borderThin, borderColor: colors.ink, borderRadius: radius.sm, padding: spacing.sm },
  footer: { textAlign: 'center', marginTop: spacing.xl },
});
