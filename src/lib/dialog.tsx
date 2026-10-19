// App-styled replacement for React Native's Alert. Same call signature as Alert.alert, rendered by <DialogHost />.
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Text } from '../components/ui';
import { brutal, colors, radius, spacing, themed } from '../theme';
import { haptic } from './haptics';

export type DialogButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type DialogOptions = { cancelable?: boolean; onDismiss?: () => void };
type DialogRequest = { title: string; message?: string; buttons: DialogButton[]; options?: DialogOptions };

const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const Alert = {
  alert(title: string, message?: string, buttons?: DialogButton[], options?: DialogOptions): void {
    queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], options });
    emit();
  },
};

export function confirm(title: string, message: string, okText: string, destructive = false): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: okText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function DialogHost() {
  const [current, setCurrent] = useState<DialogRequest | null>(queue[0] ?? null);

  useEffect(() => {
    const update = () => setCurrent(queue[0] ?? null);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  function close(button?: DialogButton) {
    const req = queue.shift();
    emit();
    if (button) button.onPress?.();
    else if (req) {
      const cancel = req.buttons.find((b) => b.style === 'cancel');
      if (cancel) cancel.onPress?.();
      else req.options?.onDismiss?.();
    }
  }

  if (!current) return null;
  const actions = current.buttons.filter((b) => b.style !== 'cancel');
  const cancel = current.buttons.find((b) => b.style === 'cancel');
  // Two choices sit side by side; menus with more options stack vertically.
  const asMenu = current.buttons.length > 2;
  const dismissable = current.options?.cancelable !== false && (!!cancel || current.buttons.length === 1 || !!current.options?.onDismiss);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {
        if (dismissable) close();
      }}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (dismissable) close();
          }}
          accessibilityLabel="Close dialog"
        />
        <View style={[styles.card, brutal.shadow]} accessibilityRole="alert">
          <Text weight="heavy" size="lg">
            {current.title}
          </Text>
          {current.message ? (
            <ScrollView style={{ maxHeight: 260 }}>
              <Text color={colors.inkMuted} style={{ lineHeight: 20 }}>
                {current.message}
              </Text>
            </ScrollView>
          ) : null}
          {asMenu ? (
            <View style={styles.menu}>
              {actions.map((b, i) => (
                <Pressable
                  key={`${b.text}-${i}`}
                  accessibilityRole="button"
                  onPress={() => {
                    haptic.tap();
                    close(b);
                  }}
                  style={({ pressed }) => [styles.menuItem, i > 0 && styles.menuDivider, pressed && { backgroundColor: colors.pressed }]}
                >
                  <Text weight="bold" color={b.style === 'destructive' ? colors.danger : colors.text}>
                    {b.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={asMenu ? undefined : styles.row}>
            {asMenu ? (
              cancel ? <Button title={cancel.text ?? 'Cancel'} variant="ghost" onPress={() => close(cancel)} /> : null
            ) : (
              <>
                {cancel ? <Button title={cancel.text ?? 'Cancel'} variant="plain" style={styles.rowButton} onPress={() => close(cancel)} /> : null}
                {actions.map((b, i) => (
                  <Button
                    key={`${b.text}-${i}`}
                    title={b.text ?? 'OK'}
                    variant={b.style === 'destructive' ? 'danger' : 'primary'}
                    style={styles.rowButton}
                    onPress={() => close(b)}
                  />
                ))}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
    card: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: brutal.border,
      borderColor: colors.ink,
      borderRadius: radius.lg,
    },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    rowButton: { flex: 1 },
    menu: { borderWidth: brutal.border, borderColor: colors.ink, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
    menuItem: { paddingVertical: 14, paddingHorizontal: spacing.md },
    menuDivider: { borderTopWidth: brutal.borderThin, borderColor: colors.ink },
  }),
);
