# Releasing Ironwyrm on Google Play

Builds run in the cloud with EAS, so no Android Studio is needed. Commands use
`npx eas-cli@latest`; install it globally (`npm i -g eas-cli`) to type `eas`.

## Before the first build

1. **Pick the final package name.** `app.json` uses
   `com.calolategan.ironwyrm`. Google Play never lets you change it after the
   first upload, so change it now if you want another one (also update
   `ios.bundleIdentifier`).
2. **Create the EAS project** (needs a free Expo account):

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   This writes `extra.eas.projectId` into `app.json`. Commit it.
3. **Host the privacy policy.** Play needs a public URL. Put
   `docs/privacy-policy.md` on any static host (GitHub Pages on a public repo,
   a gist, Notion, your site) after replacing `SUPPORT_EMAIL`.

## Build

| Profile | Use | Output |
| --- | --- | --- |
| `development` | Day-to-day work with `npx expo start` | APK with the dev client |
| `preview` | Install on your phone or share with testers | APK |
| `production` | Google Play | AAB, version code bumped automatically |

```bash
npx eas-cli@latest build --platform android --profile preview      # test on device
npx eas-cli@latest build --platform android --profile production   # for Play
```

The app version (`1.0.0`) lives in `app.json`. Version codes are stored on EAS
(`appVersionSource: remote`) and incremented on every production build.

## First upload to Play

1. Create the app in the [Play Console](https://play.google.com/console):
   default language, app name `Ironwyrm: Gym Quest RPG`, App (not Game, since
   it is a fitness tool first), Free.
2. Complete **App content**: privacy policy URL, ads (none), app access (no
   login needed), content rating and data safety (answers in
   `docs/store-listing.md`), target audience 13+, health apps declaration.
3. Fill **Store listing** from `docs/store-listing.md` and upload
   `store/play-icon-512.png`, `store/feature-graphic.png` and at least two
   phone screenshots.
4. The very first AAB must be uploaded by hand: Testing, Internal testing,
   Create release, upload the `.aab` from the EAS build page. Let Play manage
   the app signing key (the default).
5. After that, submit from the command line. Create a Google Cloud service
   account with access to the Play Console, download its JSON key, then:

   ```bash
   npx eas-cli@latest submit --platform android --profile production
   ```

   `eas.json` sends builds to the **internal** track as a **draft**, so nothing
   reaches users until you promote it in the console.

New personal developer accounts must run a closed test with at least 12
testers for 14 days before production access is granted. Plan for it.

## Updates without a store release

JavaScript and asset changes can ship over the air with EAS Update:

```bash
npx expo install expo-updates
npx eas-cli@latest update:configure
npx eas-cli@latest update --channel production --message "Balance tweaks"
```

Native changes (new native modules, permissions, icons, `app.json` plugin
changes) always need a new build.

## Release checklist

- [ ] `npm run check` passes (typecheck, lint, unit tests)
- [ ] `npm run test:e2e` passes against a fresh web export
- [ ] Preview APK installed on a real Android phone: onboarding, a full
      workout with rest timers, victory, a reminder arriving at the gym time,
      notifications permission prompt on Android 13+
- [ ] Version bumped in `app.json` for user-visible releases
- [ ] Release notes written

## Technical notes

- **Permissions** are trimmed in `app.json`: no microphone, storage, overlay
  or background media service. What remains: notifications, boot-completed
  (to restore reminders after a restart), vibration, internet (Metro in
  development) and audio settings.
- **Reminders** use local scheduled notifications without the exact-alarm
  permission, so Android may deliver them a few minutes late to save battery.
- **16 KB memory pages:** Play requires native libraries aligned for 16 KB
  pages on Android 15+ devices. React Native 0.86 and the Expo SDK 57 modules
  used here are built for it; re-check if you add a third-party native library.
- **Target API level:** Expo SDK 57 targets the API level Play currently
  requires. Upgrade the Expo SDK at least once a year to keep it current.
