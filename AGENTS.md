This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project: Ironwyrm

A gamified gym tracker: real training logic underneath, a 3D dungeon crawler on top. Read `README.md` for the feature tour.

### Where things go

- `src/domain/` is pure TypeScript with Jest tests. All training science and game rules live here (`domain/game/balance.ts` holds every tunable number). Add a test with every rule change.
- `src/state/actions.ts` is the only place that changes stores. Screens call actions; they never call `setState` on a store directly.
- `src/screens/<name>/index.tsx` holds each screen; `src/app/` route files only render a screen.
- `src/game3d/` is React Three Fiber. The React Compiler is on, so mutate three.js objects through refs inside `useFrame` (never values returned by `useMemo`), and react to bumped "key" props by comparing against stored state during render instead of calling `setState` in an effect.
- Shared UI in `src/components/`; design tokens in `src/theme/`.

### Conventions

- UI copy: sentence case, no emoji, no em dashes, no arrows appended to button labels.
- Use theme tokens for colour, spacing, radius and type. Touch targets are at least 48dp.
- Every reward moment pairs a sound (`services/sound.ts`), a haptic and a visual.
- Nested `entering` animations do not play on web while their parent is entering. Reveal children over time by mounting them later (see `useStagger` in the victory screen).
- Formatting is Prettier (`npm run format`); `npm run check` must pass before committing.

### Verifying changes

- `npm run check` for types, lint, format and unit tests.
- `npm run test:e2e` exports the web build and runs Playwright at phone size (SwiftShader WebGL renders the 3D scenes headless).
- `npm run check:native` exports the Android bundle and fails on Node-only `process` calls, which crash the app on launch even though web and Jest pass (CI runs it).
- Android-specific behaviour (notifications, haptics, native pickers) needs a development build on a device.

### Shipping

- JavaScript and asset changes reach installed apps as EAS Update over-the-air updates: CI publishes each green push to `claude/gallant-feynman-ycxw6a` to the `preview` channel.
- Native changes (new native packages, permissions, `app.json` plugins or native fields) need a new build. Bump `version` in `app.json` with them, since `runtimeVersion` follows it and old builds must not receive updates that need the new native code.
