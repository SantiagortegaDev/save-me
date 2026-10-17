// Routes content shared from other apps (Android share sheet / iOS share extension) to the share screen.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') return '/share';
    return path;
  } catch {
    return '/';
  }
}
