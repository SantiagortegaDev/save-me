# SaveMe

**Save it. Find it. Use it.** An open-source, offline-first app for saving links and images from any app — and actually coming back to them.

Every feature is free. No account, no ads, no tracking, no paywall.

## Features

- **Save from any app** with the Android share sheet / iOS share extension, or paste a link (the clipboard is read automatically).
- **Rich previews** fetched on the device (Open Graph / Twitter cards, plus oEmbed for YouTube, TikTok, Vimeo and Spotify). No backend server.
- **Images**: save screenshots and photos from the gallery or the share sheet.
- **Unlimited collections and sub-collections**, each with its own color and icon. Pin collections and saves to the top.
- **Tags, notes and search** across titles, URLs, descriptions, notes and tags.
- **Focus Mode**: review saves one card at a time, swipe to move on, open now, or shuffle.
- **Review reminders**: an optional daily notification at the time you choose when unopened saves are waiting.
- **Backup & restore** to a plain `.json` file (with or without images).
- **Import** from Pocket, Raindrop, Instapaper, Omnivore and browsers (CSV, Netscape HTML, JSON).
- **Export** as browser bookmarks (HTML) or a spreadsheet (CSV).

## Tech

Expo SDK 58 · React Native 0.88 · Expo Router · expo-sqlite · TypeScript.

```
src/app/         screens (Expo Router)
src/components/  neo-brutalist UI kit, sheets, cards
src/db/          SQLite schema + queries
src/lib/         metadata, import/export parsers, backup, reminders, settings
tests/           unit tests for the pure modules
```

## Develop

```sh
npm install
npx expo start            # press a for Android, i for iOS
npm run typecheck && npm run lint && npm test
```

Sharing into the app, notifications and SQLite need a development build (`npx expo run:android` or `eas build --profile development`); Expo Go does not include the share extension.

Build an APK for yourself:

```sh
npx eas-cli@latest build -p android --profile preview
```

## Privacy

Your library lives in a local SQLite database on your device. The only network requests SaveMe makes are fetching previews for the links you save, straight from those sites.

## License

MIT. SaveMe is an independent project; it uses no code or assets from any other app. See [docs/analysis.md](docs/analysis.md) for how its feature set was researched.
