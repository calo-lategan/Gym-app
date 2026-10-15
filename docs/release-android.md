# Releasing Ironwyrm on Google Play

Builds run in the cloud with EAS, so no Android Studio is needed. Commands use
`npx eas-cli@latest`; install it globally (`npm i -g eas-cli`) to type `eas`.

## Before the first build

1. **Pick the final package name.** `app.json` uses
   `com.calolategan.ironwyrm`. Google Play never lets you change it after the
   first upload, so change it now if you want another one (also update
   `ios.bundleIdentifier`).
2. **EAS project:** already created. `app.json` links to `@calolategan/ironwyrm`
   through `owner` and `extra.eas.projectId`, so sign in with
   `npx eas-cli@latest login` and build.
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

## Selling the calorie tracker and taking tips

The calorie tracker unlock and the three tips are Google Play in-app
products. Play requires its own billing for anything digital sold inside the
app. Tips to a developer are not tax-exempt donations, so they go through
Play Billing too: a PayPal or Ko-fi link inside the Play version would break
the payments policy.

1. **Payments profile:** Play Console, Settings, Payments profile. Play pays
   out to it and shows your name as the merchant.
2. **Upload a build first.** The Monetize section only unlocks once Play has
   a build that includes the billing library, which the production AAB does.
3. **Create the products:** Monetize with Play, Products, One-time products.
   The ids must match the app exactly:

   | Product id | Name | Suggested price |
   | --- | --- | --- |
   | `calorie_tracker` | Calorie tracker | 3.99 USD |
   | `tip_small` | Buy the smith a tea | 0.99 USD |
   | `tip_medium` | Buy the smith a meal | 2.99 USD |
   | `tip_large` | Fund a new blade | 6.99 USD |

   Play converts prices for other countries; adjust any you like, then
   activate each product. Whether a product can be bought again is decided by
   the app: tips are consumed after payment, the tracker is kept.
4. **Test without paying:** Settings, License testing, add the Google
   accounts of your testers. Purchases only work in a build installed from
   Play (internal testing is enough), never in a sideloaded preview APK.

Development and preview builds include the tracker for free so you can test
it; only builds on the `production` channel ask for the unlock. The app
acknowledges every purchase, including payments that clear later and
purchases made before a reinstall, whenever it opens. Google refunds a
purchase automatically if it is not acknowledged within three days.

## Updates without a store release

JavaScript and asset changes ship over the air with EAS Update. `expo-updates`
is installed, `runtimeVersion` follows the app `version`, and each build
profile has its own channel (`development`, `preview`, `production`).

```bash
npx eas-cli@latest update --branch preview --platform android --message "Balance tweaks"
npx eas-cli@latest update --branch production --platform android --message "Balance tweaks"
```

CI publishes every green push to `claude/gallant-feynman-ycxw6a` to the
`preview` channel when the `EXPO_TOKEN` repository secret is set. The app
checks for updates whenever it comes to the front and restarts onto a new one,
except during a workout or onboarding.

Native changes (new native modules, permissions, icons, `app.json` plugin
changes) always need a new build. Bump `version` in `app.json` with them, so
older builds, which lack the native code, stop receiving updates that need it.

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
  (to restore reminders after a restart), vibration, internet, audio
  settings, billing, and Health Connect read access to steps, distance,
  exercise sessions and weight.
- **Health Connect** needs a declaration in Play Console (App content,
  Health apps) that says why each data type is read: steps and distance for
  walking calories, exercise sessions for running calories, and weight for
  the calorie target. Samsung Health, Google Fit and most watches sync into
  Health Connect, so one integration covers them.
- **Reminders** use local scheduled notifications without the exact-alarm
  permission, so Android may deliver them a few minutes late to save battery.
- **16 KB memory pages:** Play requires native libraries aligned for 16 KB
  pages on Android 15+ devices. React Native 0.86 and the Expo SDK 57 modules
  used here are built for it; re-check if you add a third-party native library.
- **Target API level:** Expo SDK 57 targets the API level Play currently
  requires. Upgrade the Expo SDK at least once a year to keep it current.
