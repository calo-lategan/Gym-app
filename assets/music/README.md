# Ironwyrm soundtrack

Every area of the game has a music slot. A file in this folder named after a
slot fills it. The app collects the files here when it is bundled, so adding a
track needs no code change.

## Adding a track

1. Export a stereo mix named after its slot, for example `battle.mp3` or
   `camp.m4a`, into this folder. To replace a track, overwrite the file.
2. Commit and push. CI publishes the change to the `preview` channel as an
   over-the-air update, or publish it yourself:

   ```bash
   npx eas-cli@latest update --branch preview --platform android --message "Battle theme"
   ```

3. Open the app. It downloads the update and restarts onto it, then open
   Settings, Soundtrack to hear the track on its own.

Music is an asset, so no new build is ever needed for it.

## Slots

An empty slot plays its fallback, so you can start with a few themes and add
the rest over time. `battle` alone covers every workout.

| File | Plays in | Falls back to |
| --- | --- | --- |
| `title` | Onboarding | silence |
| `camp` | Camp, and the menus opened from it | dungeon ambience |
| `map` | The dungeon map | `camp` |
| `check-in` | The readiness check before a workout | `camp` |
| `battle` | Workouts | silence |
| `battle-1` to `battle-6` | Workouts in each dungeon zone, top to bottom | `battle` |
| `boss` | A floor guardian's challenge during a workout | `battle` |
| `victory` | The victory and loot screen | silence |
| `lair` | The dragon's lair | dungeon ambience |
| `merchant` | The merchant | `camp` |

The Soundtrack screen in development and preview builds shows the brief for
each slot: mood, instruments and tempo. The overall sound is Neo-Edo:
shakuhachi, koto, shamisen, biwa and taiko meeting synth pads and pulsing
bass.

## Format

- **File type:** MP3 (192 kbps or more) or M4A (AAC, 160 kbps or more). Both
  play on Android, iOS and the web. OGG plays on Android and the web only.
  Avoid WAV: a minute takes about 10 MB.
- **Size:** one to three minutes and under about 4 MB per file, since every
  update downloads new files to each phone.
- **Sample rate:** 44.1 or 48 kHz, stereo.
- **Loudness:** about -16 LUFS integrated with peaks under -1 dBTP. The app
  plays music at 60% volume under the sound effects; leave room for hits,
  coins and loot.
- **Loops:** every track loops. Make the last bar flow into the first, fold
  the reverb tail back into the start and leave no silence at either end.
  The app crossfades between areas over about a second, so no intro or
  ending is needed. If you hear a click or gap at the loop point, trim to an
  exact number of bars, or try M4A, which loops more cleanly than MP3 on some
  phones.

## Rights

Only add music you made or are licensed to publish in a paid app, and list
anything by someone else in `assets/CREDITS.md`.
