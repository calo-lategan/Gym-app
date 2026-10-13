#!/usr/bin/env node
/**
 * Builds the optimized 3D assets in assets/models from the KayKit CC0 packs.
 *
 *   node scripts/build-assets.mjs <kaykit-source-dir>
 *
 * <kaykit-source-dir> must contain clones of:
 *   KayKit-Character-Pack-Adventures-1.0
 *   KayKit-Character-Pack-Skeletons-1.0
 *   KayKit-Dungeon-Remastered-1.0
 * from https://github.com/KayKit-Game-Assets (CC0, by Kay Lousberg).
 *
 * What it does:
 *  - strips animations from character meshes (all characters share one rig),
 *  - writes two small animation libraries with only the clips the game uses,
 *  - merges the dungeon props into one GLB with a single shared texture,
 *  - downsizes the palette textures (they are smooth gradients) to save memory.
 *
 * Requires python3 with Pillow for texture resizing.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';

const src = resolve(process.argv[2] ?? '');
const out = resolve('assets/models');
mkdirSync(out, { recursive: true });
const io = new NodeIO();
const work = mkdtempSync(join(tmpdir(), 'ironwyrm-assets-'));

const ADV = join(src, 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures');
const SKEL = join(src, 'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons');
const DUN = join(src, 'KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf');

function resizePng(buffer, size) {
  const input = join(work, `in-${Math.random()}.png`);
  const output = join(work, `out-${Math.random()}.png`);
  writeFileSync(input, buffer);
  execFileSync('python3', [
    '-c',
    `from PIL import Image\nim=Image.open(${JSON.stringify(input)}).convert('RGBA')\nim=im.resize((${size},${size}), Image.LANCZOS)\nim.save(${JSON.stringify(output)}, optimize=True)`,
  ]);
  return new Uint8Array(readFileSync(output));
}

/** Dispose an animation with its channels and samplers so prune can drop the keyframe data. */
function disposeAnimation(animation) {
  for (const channel of animation.listChannels()) channel.dispose();
  for (const sampler of animation.listSamplers()) sampler.dispose();
  animation.dispose();
}

function shrinkTextures(doc, size) {
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (image && texture.getMimeType() === 'image/png') texture.setImage(resizePng(Buffer.from(image), size));
  }
}

async function write(doc, name) {
  await doc.transform(dedup(), prune({ keepLeaves: false }));
  const path = join(out, name);
  await io.write(path, doc);
  console.log(`${name.padEnd(28)} ${(statSync(path).size / 1024).toFixed(0).padStart(6)} KB`);
}

// ── Characters ────────────────────────────────────────────────
const CHARACTERS = [
  [join(ADV, 'Characters/gltf/Knight.glb'), 'hero-knight.glb'],
  [join(ADV, 'Characters/gltf/Barbarian.glb'), 'hero-barbarian.glb'],
  [join(ADV, 'Characters/gltf/Mage.glb'), 'hero-mage.glb'],
  [join(ADV, 'Characters/gltf/Rogue_Hooded.glb'), 'hero-rogue.glb'],
  [join(SKEL, 'Characters/gltf/Skeleton_Minion.glb'), 'skeleton-minion.glb'],
  [join(SKEL, 'Characters/gltf/Skeleton_Rogue.glb'), 'skeleton-rogue.glb'],
  [join(SKEL, 'Characters/gltf/Skeleton_Mage.glb'), 'skeleton-mage.glb'],
  [join(SKEL, 'Characters/gltf/Skeleton_Warrior.glb'), 'skeleton-warrior.glb'],
];

for (const [file, name] of CHARACTERS) {
  const doc = await io.read(file);
  for (const animation of doc.getRoot().listAnimations()) disposeAnimation(animation);
  shrinkTextures(doc, 256);
  await write(doc, name);
}

// ── Animation libraries ───────────────────────────────────────
const HERO_CLIPS = [
  'Idle',
  'Unarmed_Idle',
  '2H_Melee_Idle',
  'Walking_A',
  'Running_A',
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Slice_Horizontal',
  '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop',
  '2H_Melee_Attack_Slice',
  '2H_Melee_Attack_Spin',
  'Dualwield_Melee_Attack_Chop',
  'Dualwield_Melee_Attack_Slice',
  'Dualwield_Melee_Attack_Stab',
  '1H_Ranged_Shoot',
  'Spellcast_Shoot',
  'Spellcast_Raise',
  'Spellcast_Long',
  'Block',
  'Hit_A',
  'Cheer',
  'Interact',
  'PickUp',
  'Jump_Full_Short',
  'Dodge_Forward',
  'Sit_Floor_Down',
  'Sit_Floor_Idle',
  'Sit_Floor_StandUp',
  'Death_A',
];
const SKELETON_CLIPS = [
  'Idle',
  'Idle_Combat',
  'Walking_A',
  'Running_A',
  'Spawn_Ground_Skeletons',
  'Skeletons_Awaken_Floor',
  'Skeletons_Inactive_Floor_Pose',
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop',
  'Spellcast_Shoot',
  'Block',
  'Hit_A',
  'Hit_B',
  'Death_C_Skeletons',
  'Death_A',
  'Cheer',
  'Taunt',
];

async function animationLibrary(file, clips, name) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const keep = new Set(clips);
  for (const animation of root.listAnimations()) if (!keep.has(animation.getName())) disposeAnimation(animation);
  // Keep the bone hierarchy only: meshes, skins and materials are not needed.
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  await doc.transform(resample({ tolerance: 1e-4 }));
  const found = root.listAnimations().map((a) => a.getName());
  const missing = clips.filter((c) => !found.includes(c));
  if (missing.length) console.log(`  (not in source, skipped: ${missing.join(', ')})`);
  await write(doc, name);
}

await animationLibrary(join(ADV, 'Characters/gltf/Knight.glb'), HERO_CLIPS, 'anims-hero.glb');
await animationLibrary(join(SKEL, 'Characters/gltf/Skeleton_Minion.glb'), SKELETON_CLIPS, 'anims-skeleton.glb');

// ── Dungeon props ─────────────────────────────────────────────
const PROPS = [
  'floor_tile_large',
  'floor_tile_small',
  'floor_tile_small_broken_A',
  'floor_tile_small_decorated',
  'floor_tile_big_grate',
  'floor_dirt_large',
  'floor_dirt_large_rocky',
  'wall',
  'wall_doorway',
  'wall_gated',
  'wall_corner',
  'wall_arched',
  'wall_cracked',
  'wall_broken',
  'wall_pillar',
  'pillar',
  'pillar_decorated',
  'column',
  'torch_mounted',
  'torch_lit',
  'chest',
  'chest_gold',
  'stairs',
  'stairs_wide',
  'barrel_large',
  'barrel_small',
  'box_stacked',
  'crates_stacked',
  'banner_patternA_red',
  'banner_shield_red',
  'banner_thin_red',
  'candle_triple',
  'candle_lit',
  'coin',
  'coin_stack_large',
  'coin_stack_small',
  'rubble_large',
  'rubble_half',
  'sword_shield',
  'sword_shield_gold',
  'keyring_hanging',
  'trunk_medium_A',
  'bed_floor',
  'table_small',
  'stool',
];

function propPath(name) {
  for (const candidate of [`${name}.gltf.glb`, `${name}.glb`]) {
    try {
      statSync(join(DUN, candidate));
      return join(DUN, candidate);
    } catch {
      // try next
    }
  }
  throw new Error(`Missing dungeon prop ${name}`);
}

const dungeon = new Document();
dungeon.createBuffer();
const dungeonScene = dungeon.createScene('dungeon');
let sharedTexture = null;
const materials = new Map();

for (const name of PROPS) {
  const doc = await io.read(propPath(name));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const cloneNode = (node) => {
    const copy = dungeon.createNode(node.getName()).setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale());
    const mesh = node.getMesh();
    if (mesh) {
      const meshCopy = dungeon.createMesh(mesh.getName());
      for (const prim of mesh.listPrimitives()) {
        const p = dungeon.createPrimitive().setMode(prim.getMode());
        for (const semantic of prim.listSemantics()) {
          const acc = prim.getAttribute(semantic);
          p.setAttribute(
            semantic,
            dungeon.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setNormalized(acc.getNormalized()).setBuffer(dungeon.getRoot().listBuffers()[0]),
          );
        }
        const indices = prim.getIndices();
        if (indices) p.setIndices(dungeon.createAccessor().setType('SCALAR').setArray(indices.getArray().slice()).setBuffer(dungeon.getRoot().listBuffers()[0]));
        const mat = prim.getMaterial();
        if (mat) {
          const key = mat.getName() || 'texture';
          if (!materials.has(key)) {
            const tex = mat.getBaseColorTexture();
            if (tex && !sharedTexture) {
              sharedTexture = dungeon.createTexture('dungeon').setImage(resizePng(Buffer.from(tex.getImage()), 256)).setMimeType('image/png');
            }
            const m = dungeon
              .createMaterial(key)
              .setBaseColorFactor(mat.getBaseColorFactor())
              .setMetallicFactor(0)
              .setRoughnessFactor(1);
            if (tex) m.setBaseColorTexture(sharedTexture);
            materials.set(key, m);
          }
          p.setMaterial(materials.get(key));
        }
        meshCopy.addPrimitive(p);
      }
      copy.setMesh(meshCopy);
    }
    for (const child of node.listChildren()) copy.addChild(cloneNode(child));
    return copy;
  };
  const group = dungeon.createNode(name);
  for (const child of scene.listChildren()) group.addChild(cloneNode(child));
  dungeonScene.addChild(group);
}
await write(dungeon, 'dungeon.glb');
console.log('done');
