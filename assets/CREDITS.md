# Asset credits

## 3D models (assets/models)

Built from the KayKit packs by Kay Lousberg (www.kaylousberg.com), released
under Creative Commons Zero (CC0). Crediting is not required, but we do:
thank you, Kay.

- KayKit: Character Pack Adventures 1.0 (heroes)
- KayKit: Character Pack Skeletons 1.0 (monsters)
- KayKit: Dungeon Remastered 1.0 (dungeon pieces)

Source: https://github.com/KayKit-Game-Assets

The files here are optimized copies: animations are split into shared
libraries (`anims-hero.glb`, `anims-skeleton.glb`), unused clips are removed
and palette textures are downsized. Rebuild with:

    node scripts/build-assets.mjs <folder containing the three KayKit clones>

## Sound effects (assets/sounds)

Synthesized from scratch by `scripts/build-sounds.py` (oscillators, noise and
envelopes). No third-party audio is used. Rebuild with:

    python3 scripts/build-sounds.py

## Fonts

Grenze Gotisch by Omnibus-Type, SIL Open Font License 1.1, via
@expo-google-fonts/grenze-gotisch.
