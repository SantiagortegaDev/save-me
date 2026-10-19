# SaveMe

**Save it. Find it. Use it.** An open-source, offline-first app for saving links and images from any app — and actually coming back to them.

Every feature is free. No account, no ads, no tracking, no paywall.

## Features

- **Save from any app** with the Android share sheet / iOS share extension, or paste a link (the clipboard is read automatically).
- **Rich previews** fetched on the device: title, image and platform (Instagram, TikTok, YouTube, X, Reddit, Pinterest, Threads, Facebook, Spotify…). Uses oEmbed, Open Graph, JSON-LD and crawler-style requests; no backend server. Preview images are stored compressed on the phone so cards load instantly and offline.
- **Fill or Fit**: choose whether previews fill a fixed card or each card takes its image's shape, so tall screenshots and reels show complete in a masonry grid.
- **Images**: save screenshots and photos from the gallery or the share sheet.
- **Unlimited collections and sub-collections**, each with its own color and icon. Pin collections and saves to the top.
- **Tags, notes and search** across titles, URLs, descriptions, notes, tags, saved article text and text inside images.
- **Text in images (OCR)**: text in saved screenshots and photos is recognized on the device (ML Kit / Apple Vision), so you can search it and copy it.
- **Offline reading**: a clean, readable copy of saved articles is stored on the phone; open it from a save with *Read offline*.
- **Select several saves** to move, tag, pin, mark as opened or delete them in one go.
- **Dark mode**: follows your phone, or force light or dark in Settings. The launcher icon switches too.
- **In-app updates** (Android): SaveMe checks GitHub for a new release and downloads and installs the APK for you.
- **Focus Mode**: review saves one card at a time, swipe to move on, open now, or shuffle.
- **Review reminders**: an optional daily notification at the time you choose when unopened saves are waiting.
- **Backup & restore** to a plain `.json` file (with or without images).
- **Import** from Pocket, Raindrop, Instapaper, Omnivore and browsers (CSV, Netscape HTML, JSON).
- **Export** as browser bookmarks (HTML) or a spreadsheet (CSV).
- **Claude (MCP)**, off by default: give Claude a private link so it can search your library and, if you allow it, organize it (move saves, create and nest collections, tag, pin, edit notes). Regenerate or revoke the link any time. See [mcp-server/](mcp-server/README.md).

## Tech

Expo SDK 58 · React Native 0.88 · Expo Router · expo-sqlite · TypeScript.

```
src/app/         screens (Expo Router)
src/components/  neo-brutalist UI kit, sheets, cards
src/db/          SQLite schema + queries
src/lib/         metadata, platforms, thumbnails, import/export parsers, backup, reminders, settings, MCP sync
src/shared/      wire format shared with the MCP server
mcp-server/      Cloudflare Worker that serves the Claude connector
tests/           unit tests for the pure modules
```

Icons are generated from `assets/brand/logo.svg` with `node scripts/make-icons.mjs` (light, dark and tinted iOS icons, Android adaptive icon with a dark-mode background, monochrome, splash and notification icons).

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

Your library lives in a local SQLite database on your device. By default the only network requests SaveMe makes are fetching previews for the links you save: straight from those sites, from their public oEmbed endpoints, from `api.fxtwitter.com` for X posts, and site icons from DuckDuckGo's icon service.

If you turn on **Claude (MCP)**, a text copy of your library (links, titles, notes, tags and collections, never image files) is kept on `mcp-saveme.santiagortega.dev` so Claude can reach it with your private link. Turning it off deletes that copy.

## License

MIT. SaveMe is an independent project; it uses no code or assets from any other app. See [docs/analysis.md](docs/analysis.md) for how its feature set was researched.

## Download

Every push to `main` builds an APK with GitHub Actions: open the latest run under **Actions → Build Android APK** and download the `SaveMe-apk` artifact. To publish a release (release files never expire, unlike workflow artifacts which GitHub deletes after 90 days), run **Actions → Build Android APK → Run workflow** with a tag such as `v1.0.1`, or push that tag.

These builds are signed with a debug key, so Android will ask you to allow installing from unknown sources. Use your own keystore before publishing to an app store.
