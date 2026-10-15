/// <reference types="expo/types" />
import type { AudioSource } from 'expo-audio';

/**
 * Every audio file in assets/music, collected when the app is bundled, keyed
 * by file name without the extension. Adding a file needs no code change.
 */
const files = require.context('../../assets/music', false, /\.(mp3|m4a|aac|ogg|wav)$/);

export const MUSIC_FILES: Readonly<Record<string, AudioSource>> = Object.fromEntries(
  files.keys().map((key) => [key.replace(/^\.\//, '').replace(/\.\w+$/, ''), files(key) as AudioSource]),
);
