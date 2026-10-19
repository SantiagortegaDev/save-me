// Detects new GitHub releases and installs the APK on Android.
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { Alert } from './dialog';
import { currentSettings, type Settings } from './settings';
import { compareVersions, parseRelease, shortNotes, type Release } from './updateCheck';

const LATEST_URL = 'https://api.github.com/repos/SantiagortegaDev/save-me/releases/latest';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export async function fetchLatestRelease(): Promise<Release | null> {
  const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return parseRelease(await res.json());
}

// --- download progress, shown in Settings -------------------------------------

export type UpdateProgress = { version: string; fraction: number | null } | null;
let progress: UpdateProgress = null;
const listeners = new Set<(p: UpdateProgress) => void>();

function setProgress(p: UpdateProgress) {
  progress = p;
  listeners.forEach((l) => l(p));
}

export function subscribeUpdateProgress(listener: (p: UpdateProgress) => void): () => void {
  listeners.add(listener);
  listener(progress);
  return () => {
    listeners.delete(listener);
  };
}

export async function installRelease(release: Release): Promise<void> {
  if (Platform.OS !== 'android' || !release.apkUrl) {
    await WebBrowser.openBrowserAsync(release.pageUrl || release.apkUrl || '');
    return;
  }
  if (progress) return;
  setProgress({ version: release.version, fraction: 0 });
  try {
    const dir = new Directory(Paths.cache, 'updates');
    dir.create({ idempotent: true, intermediates: true });
    const target = new File(dir, `saveme-${release.version}.apk`);
    const file = await File.downloadFileAsync(release.apkUrl, target, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) =>
        setProgress({ version: release.version, fraction: totalBytes > 0 ? bytesWritten / totalBytes : null }),
    });
    const contentUri = await getContentUriAsync(file.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: 'application/vnd.android.package-archive',
    });
  } catch (error) {
    console.warn('[updates] install failed', error);
    // The browser can still download and open the APK.
    await Linking.openURL(release.apkUrl).catch(() => {});
  } finally {
    setProgress(null);
  }
}

function offer(release: Release, update: (patch: Partial<Settings>) => Promise<void>, manual: boolean) {
  const notes = shortNotes(release.notes);
  Alert.alert(
    `SaveMe ${release.version} is out`,
    `You have ${appVersion()}.${notes ? `\n\n${notes}` : ''}`,
    [
      { text: Platform.OS === 'android' && release.apkUrl ? 'Update now' : 'View release', onPress: () => void installRelease(release) },
      ...(manual ? [] : [{ text: 'Skip this version', onPress: () => void update({ skippedVersion: release.version }) }]),
      { text: 'Later', style: 'cancel' as const },
    ],
  );
}

// manual: from Settings, always reports the result; otherwise quiet, throttled and honoring skipped versions.
export async function checkForUpdates(update: (patch: Partial<Settings>) => Promise<void>, manual = false): Promise<Release | null> {
  if (Platform.OS === 'web') return null;
  const settings = currentSettings();
  if (!manual && Date.now() - settings.lastUpdateCheck < CHECK_EVERY_MS) return null;
  try {
    const release = await fetchLatestRelease();
    await update({ lastUpdateCheck: Date.now() });
    const newer = release && compareVersions(release.version, appVersion()) > 0 ? release : null;
    if (newer && (manual || settings.skippedVersion !== newer.version)) offer(newer, update, manual);
    else if (manual) Alert.alert('You are up to date', `SaveMe ${appVersion()} is the latest version.`);
    return newer;
  } catch (error) {
    if (manual) Alert.alert('Could not check for updates', 'Check your connection and try again.');
    else console.warn('[updates] check failed', error);
    return null;
  }
}
