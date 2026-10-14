import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LevelCrest } from '@/components/hero-hud';
import { Icon, type IconName } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { Text } from '@/components/text';
import { findExercise } from '@/domain/exercises';
import { BALANCE, rarityRank } from '@/domain/game/balance';
import { dragonHealth } from '@/domain/game/dragon';
import type { DungeonEvent } from '@/domain/game/dungeon';
import { describeBonus, RARITY_LABELS } from '@/domain/game/loot';
import { SLOT_LABELS, STAT_INFO, xpToNext } from '@/domain/game/progression';
import type { LootDrop } from '@/domain/game/rewards';
import { streakBonusPct } from '@/domain/game/streak';
import { PR_LABELS, prSummary } from '@/domain/records';
import type { StatKey, WeightUnit } from '@/domain/types';
import { VictoryScene, type VictorySceneChest } from '@/game3d/scenes/victory-scene';
import { haptics } from '@/services/haptics';
import { lootSound, play } from '@/services/sound';
import { useGame, type StoredOutcome } from '@/state/stores';
import { colors, fonts, radius, rarityColors, spacing } from '@/theme';

// ── Beats ──────────────────────────────────────────────────────────

type Beat =
  | { kind: 'summary' }
  | { kind: 'xp' }
  | { kind: 'gold' }
  | { kind: 'stats' }
  | { kind: 'streak' }
  | { kind: 'prs' }
  | { kind: 'loot'; drop: LootDrop; index: number }
  | { kind: 'boss' }
  | { kind: 'dungeon' }
  | { kind: 'dragon' }
  | { kind: 'done' };

const STAT_ORDER: StatKey[] = ['str', 'end', 'agi', 'vit'];
const MAX_PRS_SHOWN = 3;

const statGainsOf = (o: StoredOutcome) => STAT_ORDER.flatMap((k) => ((o.statGains[k] ?? 0) > 0 ? [{ key: k, amount: o.statGains[k] ?? 0 }] : []));

/** Dungeon events worth a line; a boss kill gets its own beat. */
const dungeonLines = (o: StoredOutcome) => o.dungeonEvents.filter((e) => e.type !== 'boss_defeated' || !o.boss);

function buildBeats(o: StoredOutcome): Beat[] {
  const beats: Beat[] = [{ kind: 'summary' }, { kind: 'xp' }];
  if (o.gold > 0) beats.push({ kind: 'gold' });
  if (statGainsOf(o).length > 0) beats.push({ kind: 'stats' });
  if (o.streak.after > o.streak.before) beats.push({ kind: 'streak' });
  if (o.prs.length > 0) beats.push({ kind: 'prs' });
  o.loot.forEach((drop, index) => beats.push({ kind: 'loot', drop, index }));
  if (o.boss) beats.push({ kind: 'boss' });
  if (dungeonLines(o).length > 0) beats.push({ kind: 'dungeon' });
  if (o.dragon && (o.dragon.after > o.dragon.before || o.dragon.lines.length > 0)) beats.push({ kind: 'dragon' });
  beats.push({ kind: 'done' });
  return beats;
}

function beatDuration(beat: Beat, o: StoredOutcome): number {
  switch (beat.kind) {
    case 'summary':
      return 2200;
    case 'xp':
      return 2300 + o.levelsGained * 1400;
    case 'gold':
      return 1600;
    case 'stats':
      return 1300 + statGainsOf(o).length * 450;
    case 'streak':
      return 1700;
    case 'prs':
      return 1400 + Math.min(MAX_PRS_SHOWN, o.prs.length) * 700;
    case 'loot': {
      const rank = rarityRank(beat.drop.item.rarity);
      return rank >= rarityRank('legendary') ? 4000 : rank >= rarityRank('epic') ? 3400 : 2900;
    }
    case 'boss':
      return 2600;
    case 'dungeon':
      return 1300 + dungeonLines(o).length * 750;
    case 'dragon':
      return 3000 + (o.dragon?.lines.length ?? 0) * 700;
    case 'done':
      return Number.POSITIVE_INFINITY;
  }
}

/** Level and XP into that level after `gained` XP, mirroring addXp. */
function xpStateAt(level: number, xp: number, gained: number) {
  let lv = level;
  let rest = xp + gained;
  while (rest >= xpToNext(lv)) {
    rest -= xpToNext(lv);
    lv++;
  }
  return { level: lv, xp: rest, need: xpToNext(lv) };
}

function bestDrop(loot: LootDrop[]): LootDrop | null {
  return loot.reduce<LootDrop | null>((best, d) => (!best || rarityRank(d.item.rarity) > rarityRank(best.item.rarity) ? d : best), null);
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const isGold = (rarity: LootDrop['item']['rarity']) => rarityRank(rarity) >= rarityRank('epic');

// ── Timing helpers ─────────────────────────────────────────────────

/** Runs each step once at its delay after mount and cancels the rest on unmount. */
function useSchedule(build: () => [number, () => void][]) {
  const ref = useRef(build);
  useEffect(() => {
    const timers = ref.current().map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
}

/** Eased count from 0 to `target`. Jumps straight there when motion is reduced. */
function useCountUp(target: number, durationMs: number, delayMs = 0, onStep?: (value: number) => void): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });
  const instant = reduced || target <= 0;
  useEffect(() => {
    if (instant) return;
    let frame = 0;
    let last = -1;
    const start = Date.now() + delayMs;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / durationMs));
      const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (v !== last) {
        last = v;
        setValue(v);
        step.current?.(v);
      }
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, delayMs, instant]);
  return instant ? target : value;
}

/**
 * How many of `count` items are revealed so far, one every `stepMs` after
 * `startMs`. Items mount when revealed, so their entering animation always
 * plays (nested delayed entering animations are skipped on web).
 */
function useStagger(count: number, startMs: number, stepMs: number): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = Array.from({ length: count }, (_, i) => setTimeout(() => setShown(i + 1), startMs + i * stepMs));
    return () => timers.forEach(clearTimeout);
  }, [count, startMs, stepMs]);
  return shown;
}

// ── Effects bus ────────────────────────────────────────────────────

type FxKey = 'cheer' | 'ring' | 'level' | 'coin' | 'shake';

interface Fx {
  bump: (...keys: FxKey[]) => void;
  setChest: (chest: VictorySceneChest | null) => void;
  flash: (color: string) => void;
}

// ── Screen ─────────────────────────────────────────────────────────

export function VictoryScreen() {
  const outcome = useGame((s) => s.lastOutcome);
  if (!outcome) return <NoOutcome />;
  return <VictorySequence key={outcome.sessionId} outcome={outcome} />;
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function NoOutcome() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.abyss,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
        gap: spacing.md,
      }}
    >
      <Icon name="swords" size={40} color={colors.dim} />
      <Text variant="title" align="center">
        No battle to report yet
      </Text>
      <Text variant="subhead" align="center">
        Finish a workout and your rewards will be counted here.
      </Text>
      <Button title="Return to camp" onPress={leave} testID="victory-return" />
    </View>
  );
}

function VictorySequence({ outcome }: { outcome: StoredOutcome }) {
  const insets = useSafeAreaInsets();
  const hero = useGame((s) => s.hero);
  const graphics = useGame((s) => s.settings.graphics);
  const beats = useMemo(() => buildBeats(outcome), [outcome]);
  const [index, setIndex] = useState(0);
  const beat = beats[index];
  const done = beat.kind === 'done';

  const [keys, setKeys] = useState<Record<FxKey, number>>({
    cheer: 0,
    ring: 0,
    level: 0,
    coin: 0,
    shake: 0,
  });
  const [chest, setChest] = useState<VictorySceneChest | null>(outcome.loot.length > 0 ? { key: 0, open: false, color: null, gold: false } : null);
  const [flashColor, setFlashColor] = useState<{
    color: string;
    key: number;
  } | null>(null);

  const fx = useMemo<Fx>(
    () => ({
      bump: (...names) =>
        setKeys((k) => {
          const next = { ...k };
          for (const n of names) next[n] += 1;
          return next;
        }),
      setChest,
      flash: (color) => setFlashColor((f) => ({ color, key: (f?.key ?? 0) + 1 })),
    }),
    [],
  );

  useEffect(() => {
    if (!flashColor) return;
    const t = setTimeout(() => setFlashColor(null), 220);
    return () => clearTimeout(t);
  }, [flashColor]);

  const last = beats.length - 1;

  // The final tableau: the best chest stands open and the hero cheers once more.
  const finale = useCallback(() => {
    const best = bestDrop(outcome.loot);
    if (best) {
      setChest((c) =>
        c?.open
          ? c
          : {
              key: 99,
              open: true,
              color: rarityColors[best.item.rarity],
              gold: isGold(best.item.rarity),
            },
      );
    }
    if (outcome.completed) fx.bump('cheer');
  }, [fx, outcome]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(next, last);
      setIndex(target);
      if (target === last) finale();
    },
    [finale, last],
  );

  // Each beat moves on by itself; a tap moves on sooner.
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => goTo(index + 1), beatDuration(beat, outcome));
    return () => clearTimeout(t);
  }, [beat, done, goTo, index, outcome]);

  const advance = useCallback(() => goTo(index + 1), [goTo, index]);
  const skipAll = useCallback(() => goTo(last), [goTo, last]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }} testID="victory-screen">
      <View style={StyleSheet.absoluteFill}>
        {graphics === 'full' ? (
          <VictoryScene
            hero={hero}
            floor={outcome.floorAfter}
            triumphant={outcome.completed}
            cheerKey={keys.cheer}
            ringKey={keys.ring}
            levelKey={keys.level}
            coinKey={keys.coin}
            shakeKey={keys.shake}
            chest={chest}
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.stone,
              experimental_backgroundImage: `radial-gradient(circle at 50% 35%, ${chest?.color ?? colors.torch}44 0%, transparent 65%)`,
            }}
          />
        )}
      </View>

      {/* Keeps the reward text readable over the scene. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '58%',
          experimental_backgroundImage: 'linear-gradient(to bottom, rgba(6,10,9,0) 0%, rgba(6,10,9,0.86) 38%, rgba(6,10,9,0.96) 100%)',
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityHint="Shows the next reward"
        disabled={done}
        onPress={advance}
        style={StyleSheet.absoluteFill}
        testID="victory-advance"
      />

      {flashColor ? (
        <Animated.View
          key={flashColor.key}
          pointerEvents="none"
          entering={FadeIn.duration(90)}
          exiting={FadeOut.duration(700)}
          style={[StyleSheet.absoluteFill, { backgroundColor: `${flashColor.color}59` }]}
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={{
          paddingTop: insets.top + spacing.xs,
          paddingHorizontal: spacing.md,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            minHeight: 48,
          }}
        >
          {!done ? <Button title="Skip" variant="ghost" size="sm" onPress={skipAll} testID="victory-skip" sound={null} /> : null}
        </View>
        <Title outcome={outcome} />
      </View>

      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.ms,
        }}
      >
        {done ? (
          <Summary outcome={outcome} />
        ) : (
          <>
            <BeatView key={index} beat={beat} outcome={outcome} fx={fx} />
            <Pips total={beats.length - 1} index={index} />
          </>
        )}
      </View>
    </View>
  );
}

function Title({ outcome }: { outcome: StoredOutcome }) {
  const won = outcome.completed;
  useSchedule(() => [
    [
      0,
      () => {
        play(won ? 'victory' : 'setEnd', 0.9);
        if (won) haptics.success();
        else haptics.light();
      },
    ],
  ]);
  return (
    <View pointerEvents="none" style={{ alignItems: 'center' }}>
      <Animated.View entering={ZoomIn.springify().damping(11).stiffness(170)}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            lineHeight: 70,
            color: won ? colors.torchHigh : colors.bone,
            textShadowColor: won ? 'rgba(242, 169, 59, 0.85)' : 'rgba(0, 0, 0, 0.9)',
            textShadowRadius: 22,
          }}
        >
          {won ? 'Victory' : 'Retreat'}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(350).duration(400)}>
        <Text variant="subhead" align="center" color={colors.bone} style={{ textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 8 }}>
          {won
            ? `${outcome.title}, ${formatDuration(outcome.durationSec)}`
            : `Log ${outcome.setsNeeded} sets to clear a room. You logged ${outcome.completedSets}.`}
        </Text>
      </Animated.View>
    </View>
  );
}

function Pips({ total, index }: { total: number; index: number }) {
  return (
    <View pointerEvents="none" style={{ alignItems: 'center', gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i < index ? colors.torchDeep : i === index ? colors.torch : colors.seam,
            }}
          />
        ))}
      </View>
      <Text variant="label" color={colors.dim}>
        Tap to continue
      </Text>
    </View>
  );
}

/** Frame for the reward on stage. Taps fall through to the continue layer. */
function Card({ children, glow, testID }: { children: ReactNode; glow?: string; testID?: string }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      testID={testID}
      style={{
        backgroundColor: colors.glass,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: glow ? 2 : 1,
        borderColor: glow ?? colors.seam,
        padding: spacing.md,
        gap: spacing.ms,
        boxShadow: glow ? `0 0 36px ${glow}66` : '0 12px 30px rgba(0, 0, 0, 0.45)',
      }}
    >
      {children}
    </Animated.View>
  );
}

function BigNumber({ children, color = colors.torchHigh, size = 44 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <Text
      style={{
        fontFamily: fonts.display,
        fontSize: size,
        lineHeight: size * 1.1,
        color,
        fontVariant: ['tabular-nums'],
        textShadowColor: `${color}AA`,
        textShadowRadius: 14,
      }}
    >
      {children}
    </Text>
  );
}

function BeatView({ beat, outcome, fx }: { beat: Beat; outcome: StoredOutcome; fx: Fx }) {
  const unit = useGame((s) => s.profile.unit);
  switch (beat.kind) {
    case 'summary':
      return <SummaryBeat outcome={outcome} fx={fx} />;
    case 'xp':
      return <XpBeat outcome={outcome} fx={fx} />;
    case 'gold':
      return <GoldBeat outcome={outcome} fx={fx} />;
    case 'stats':
      return <StatsBeat outcome={outcome} />;
    case 'streak':
      return <StreakBeat outcome={outcome} fx={fx} />;
    case 'prs':
      return <RecordsBeat outcome={outcome} unit={unit} fx={fx} />;
    case 'loot':
      return <LootBeat drop={beat.drop} index={beat.index} fx={fx} />;
    case 'boss':
      return <BossBeat outcome={outcome} fx={fx} />;
    case 'dungeon':
      return <DungeonBeat outcome={outcome} fx={fx} />;
    case 'dragon':
      return <DragonBeat outcome={outcome} fx={fx} />;
    case 'done':
      return null;
  }
}

function Tile({ label, value, color = colors.bone }: { label: string; value: string; color?: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: 'rgba(0,0,0,0.25)',
      }}
    >
      <Text variant="stat" color={color}>
        {value}
      </Text>
      <Text variant="label">{label}</Text>
    </View>
  );
}

function SummaryBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  useSchedule(() => [[0, () => fx.bump('cheer', 'ring', 'shake')]]);
  const foes = outcome.dungeonEvents.reduce((n, e) => n + (e.type === 'room_cleared' ? e.monsters.length : 0), 0);
  return (
    <Card testID="beat-summary">
      <Text variant="heading" align="center">
        {outcome.completed ? 'The room is yours' : 'You live to fight again'}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Tile label="Sets" value={`${outcome.completedSets}/${outcome.plannedSets}`} />
        <Tile label="Foes felled" value={String(foes)} color={foes ? colors.torchHigh : colors.bone} />
        <Tile label="Records" value={String(outcome.prs.length)} color={outcome.prs.length ? colors.torchHigh : colors.bone} />
      </View>
    </Card>
  );
}

function XpBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  const total = outcome.xp.total;
  const lastTick = useRef(0);
  const shown = useCountUp(total, 1300 + outcome.levelsGained * 900, 250, () => {
    const now = Date.now();
    if (now - lastTick.current > 65) {
      lastTick.current = now;
      play('xpTick', 0.3);
    }
  });
  const state = xpStateAt(outcome.levelBefore, outcome.xpBefore ?? 0, shown);
  const leveled = state.level > outcome.levelBefore;
  const seenLevel = useRef(outcome.levelBefore);
  useEffect(() => {
    if (state.level <= seenLevel.current) return;
    seenLevel.current = state.level;
    play('levelUp', 0.95);
    haptics.heavy();
    fx.bump('level', 'ring', 'shake');
    fx.flash(colors.torch);
  }, [state.level, fx]);

  const parts: { label: string; value: string }[] = [];
  if (outcome.xp.sets) parts.push({ label: 'Sets', value: `+${outcome.xp.sets}` });
  if (outcome.xp.completion) parts.push({ label: 'Quest', value: `+${outcome.xp.completion}` });
  if (outcome.xp.prs) parts.push({ label: 'Records', value: `+${outcome.xp.prs}` });
  if (outcome.xp.boss) parts.push({ label: 'Boss', value: `+${outcome.xp.boss}` });
  if (outcome.xp.bonusPct) parts.push({ label: 'Bonus', value: `+${outcome.xp.bonusPct}%` });

  return (
    <Card testID="beat-xp" glow={leveled ? colors.torch : undefined}>
      {leveled ? (
        <Animated.View key={state.level} entering={ZoomIn.springify().damping(9)} style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 34,
              lineHeight: 38,
              color: colors.torchHigh,
              textShadowColor: 'rgba(242,169,59,0.9)',
              textShadowRadius: 18,
            }}
          >
            Level up
          </Text>
        </Animated.View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Animated.View key={state.level} entering={leveled ? ZoomIn.springify().damping(8) : undefined}>
          <LevelCrest level={state.level} size={58} />
        </Animated.View>
        <View style={{ flex: 1, gap: 6 }}>
          <BigNumber>+{shown} XP</BigNumber>
          <ProgressBar
            key={state.level}
            value={state.xp / state.need}
            durationMs={90}
            height={12}
            accessibilityLabel={`Experience ${state.xp} of ${state.need}`}
          />
          <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
            {state.xp} / {state.need} to level {state.level + 1}
          </Text>
        </View>
      </View>
      {parts.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {parts.map((p) => (
            <View
              key={p.label}
              style={{
                flexDirection: 'row',
                gap: 4,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: 'rgba(242,169,59,0.12)',
              }}
            >
              <Text variant="label">{p.label}</Text>
              <Text variant="label" color={colors.torchHigh}>
                {p.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function GoldBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  const purse = useGame((s) => s.hero.gold);
  useSchedule(() => [
    [0, () => fx.bump('coin')],
    ...[80, 220, 380, 560, 760].map((ms): [number, () => void] => [
      ms,
      () => {
        play('coin', 0.55);
        haptics.light();
      },
    ]),
  ]);
  const shown = useCountUp(outcome.gold, 900, 100);
  return (
    <Card testID="beat-gold">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Animated.View entering={ZoomIn.springify().damping(8)}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: 'rgba(242,169,59,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.torch,
            }}
          >
            <Icon name="coin" size={30} color={colors.torchHigh} />
          </View>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <BigNumber>+{shown} gold</BigNumber>
          <Text variant="caption">Purse: {purse} gold. Spend it at the merchant.</Text>
        </View>
      </View>
    </Card>
  );
}

function StatsBeat({ outcome }: { outcome: StoredOutcome }) {
  const gains = statGainsOf(outcome);
  useSchedule(() =>
    gains.map((_, i): [number, () => void] => [
      250 + i * 450,
      () => {
        play('statUp', 0.85);
        haptics.impact();
      },
    ]),
  );
  const shown = useStagger(gains.length, 250, 450);
  return (
    <Card testID="beat-stats">
      <Text variant="heading" align="center">
        Your hero grows stronger
      </Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: 96,
        }}
      >
        {gains.slice(0, shown).map((g) => (
          <Animated.View
            key={g.key}
            entering={ZoomIn.springify().damping(9)}
            style={{
              minWidth: 76,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.ms,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.torch,
              backgroundColor: 'rgba(242,169,59,0.1)',
            }}
          >
            <BigNumber size={32}>+{g.amount}</BigNumber>
            <Text variant="label" color={colors.torchHigh}>
              {STAT_INFO[g.key].short}
            </Text>
            <Text variant="label">{STAT_INFO[g.key].label}</Text>
          </Animated.View>
        ))}
      </View>
    </Card>
  );
}

function StreakBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  useSchedule(() => [
    [
      100,
      () => {
        play('streak', 0.9);
        haptics.impact();
        fx.flash(colors.ember);
      },
    ],
  ]);
  const bonus = streakBonusPct(outcome.streak.after, BALANCE.xp.streakPctPerDay, BALANCE.xp.streakPctCap);
  return (
    <Card testID="beat-streak" glow={colors.ember}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Animated.View entering={ZoomIn.springify().damping(8)}>
          <Icon name="camp" size={52} color={colors.ember} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <BigNumber color={colors.ember}>{outcome.streak.after} day streak</BigNumber>
          <Text variant="caption">Your streak adds {bonus}% XP to every quest. Keep the fire lit.</Text>
        </View>
      </View>
    </Card>
  );
}

function RecordsBeat({ outcome, unit, fx }: { outcome: StoredOutcome; unit: WeightUnit; fx: Fx }) {
  const shown = outcome.prs.slice(0, MAX_PRS_SHOWN);
  useSchedule(() =>
    shown.map((_, i): [number, () => void] => [
      150 + i * 700,
      () => {
        play('pr', 0.85);
        haptics.success();
        fx.bump('ring');
      },
    ]),
  );
  const revealed = useStagger(shown.length, 150, 700);
  return (
    <Card testID="beat-records" glow={colors.torch}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          justifyContent: 'center',
        }}
      >
        <Icon name="trophy" size={28} color={colors.torchHigh} />
        <BigNumber size={34}>{outcome.prs.length === 1 ? 'New record' : `${outcome.prs.length} new records`}</BigNumber>
      </View>
      {shown.slice(0, revealed).map((pr) => (
        <Animated.View key={`${pr.exerciseId}-${pr.kind}-${pr.setId}`} entering={FadeInDown.springify()} style={{ gap: 2 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: spacing.sm,
            }}
          >
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {findExercise(pr.exerciseId)?.name ?? 'Exercise'}
            </Text>
            <Text variant="label" color={colors.torchHigh}>
              {PR_LABELS[pr.kind]}
            </Text>
          </View>
          <Text variant="caption">{prSummary(pr, unit)}</Text>
        </Animated.View>
      ))}
      {outcome.prs.length > shown.length ? (
        <Text variant="caption" color={colors.dim}>
          And {outcome.prs.length - shown.length} more in your records.
        </Text>
      ) : null}
    </Card>
  );
}

function LootBeat({ drop, index, fx }: { drop: LootDrop; index: number; fx: Fx }) {
  const { item } = drop;
  const color = rarityColors[item.rarity];
  const rank = rarityRank(item.rarity);
  const reveal = 950;
  useSchedule(() => [
    [
      0,
      () =>
        fx.setChest({
          key: index + 1,
          open: false,
          color: null,
          gold: isGold(item.rarity),
        }),
    ],
    [
      420,
      () => {
        fx.setChest({
          key: index + 1,
          open: true,
          color,
          gold: isGold(item.rarity),
        });
        play('chestOpen', 0.9);
        haptics.impact();
        fx.bump('shake');
      },
    ],
    [
      reveal,
      () => {
        play(lootSound(item.rarity), 0.95);
        if (rank >= rarityRank('epic')) {
          haptics.heavy();
          fx.flash(color);
          fx.bump('ring', 'cheer');
        } else {
          haptics.success();
        }
      },
    ],
  ]);
  const revealed = useStagger(1, reveal, 0) > 0;
  const source =
    drop.source === 'level' ? 'Level reward' : drop.source === 'boss' ? 'Boss hoard' : drop.source === 'floor' ? 'Floor vault' : 'Room chest';
  return (
    <Card testID="beat-loot">
      <Text variant="label" align="center" color={colors.dim}>
        {source}
      </Text>
      {revealed ? (
        <Animated.View entering={ZoomIn.springify().damping(10)} style={{ gap: spacing.sm }}>
          <View
            style={{
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: color,
              padding: spacing.ms,
              gap: 6,
              backgroundColor: `${color}14`,
              boxShadow: `0 0 28px ${color}88`,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="label" color={color}>
                {RARITY_LABELS[item.rarity]} {SLOT_LABELS[item.slot].toLowerCase()}
              </Text>
              {drop.equipped ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: 'rgba(102,212,156,0.16)',
                  }}
                >
                  <Icon name="check" size={12} color={colors.verdant} />
                  <Text variant="label" color={colors.verdant}>
                    Equipped
                  </Text>
                </View>
              ) : (
                <Text variant="label">In your pack</Text>
              )}
            </View>
            <Text
              style={{
                fontFamily: fonts.displayBold,
                fontSize: 26,
                lineHeight: 30,
                color: colors.bone,
              }}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Text variant="bodyStrong" color={color}>
                Power {item.power}
              </Text>
              {describeBonus(item.bonus) ? <Text variant="bodyStrong">{describeBonus(item.bonus)}</Text> : null}
            </View>
          </View>
        </Animated.View>
      ) : (
        <View style={{ height: 118 }} />
      )}
    </Card>
  );
}

function BossBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  const boss = outcome.boss!;
  useSchedule(() =>
    boss.success
      ? [
          [
            100,
            () => {
              play('monsterDeath', 0.9);
              play('crit', 0.9);
              haptics.heavy();
              fx.bump('shake', 'ring', 'cheer');
              fx.flash(colors.torch);
            },
          ],
        ]
      : [
          [
            100,
            () => {
              play('bossRoar', 0.6);
              haptics.warning();
              fx.bump('shake');
            },
          ],
        ],
  );
  return (
    <Card testID="beat-boss" glow={boss.success ? colors.torch : colors.ember}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Animated.View entering={ZoomIn.springify().damping(8)}>
          <Icon name={boss.success ? 'crown' : 'skull'} size={48} color={boss.success ? colors.torchHigh : colors.ember} />
        </Animated.View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color={boss.success ? colors.torchHigh : colors.ember}>
            {boss.success ? 'Miniboss defeated' : 'The guardian holds'}
          </Text>
          <Text
            style={{
              fontFamily: fonts.displayBold,
              fontSize: 28,
              lineHeight: 32,
              color: colors.bone,
            }}
            numberOfLines={2}
          >
            {boss.name}
          </Text>
          <Text variant="caption">
            {boss.success
              ? 'Its hoard is yours and the stairs lie open.'
              : 'It waits for you next week. Every set you log makes you stronger for the rematch.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function dungeonLine(event: DungeonEvent, bossName: string): { icon: IconName; color: string; text: string; sub?: string } {
  switch (event.type) {
    case 'room_cleared':
      return {
        icon: 'swords',
        color: colors.torch,
        text: `Room ${event.room} cleared, ${event.monsters.length} ${event.monsters.length === 1 ? 'foe' : 'foes'} felled`,
      };
    case 'sigil':
      return {
        icon: 'unlock',
        color: colors.verdant,
        text: 'Your record broke the gate seal',
      };
    case 'gate_sealed':
      return {
        icon: 'lock',
        color: colors.ember,
        text: 'The gate is sealed',
        sub: 'Set any personal record to break it.',
      };
    case 'boss_chamber':
      return {
        icon: 'skull',
        color: colors.ember,
        text: `${bossName} guards the stairs`,
        sub: 'Face it on a training day this week.',
      };
    case 'boss_defeated':
      return {
        icon: 'crown',
        color: colors.torchHigh,
        text: `${event.name} defeated`,
      };
    case 'descended':
      return {
        icon: 'stairs',
        color: colors.torchHigh,
        text: `Descended to floor ${event.floor}`,
        sub: event.newZone ? `Entering ${event.zone}` : undefined,
      };
  }
}

function DungeonBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  const bossName = useGame((s) => s.dungeon.boss?.name ?? 'A guardian');
  const events = dungeonLines(outcome);
  useSchedule(() =>
    events.map((e, i): [number, () => void] => [
      120 + i * 750,
      () => {
        if (e.type === 'descended') {
          play('gateOpen', 0.9);
          haptics.heavy();
          fx.bump('shake');
        } else if (e.type === 'room_cleared') {
          play('monsterDeath', 0.6);
          haptics.light();
        } else if (e.type === 'sigil') {
          play('crit', 0.8);
          haptics.success();
          fx.bump('ring');
        } else if (e.type === 'gate_sealed') {
          play('hit', 0.6);
          haptics.warning();
        } else if (e.type === 'boss_chamber') {
          play('bossRoar', 0.55);
          haptics.warning();
        }
      },
    ]),
  );
  const revealed = useStagger(events.length, 120, 750);
  return (
    <Card testID="beat-dungeon">
      <Text variant="heading">Floor {outcome.floorBefore}</Text>
      {events.slice(0, revealed).map((e, i) => {
        const line = dungeonLine(e, bossName);
        return (
          <Animated.View
            key={i}
            entering={FadeInDown.springify()}
            style={{
              flexDirection: 'row',
              gap: spacing.ms,
              alignItems: 'flex-start',
            }}
          >
            <Icon name={line.icon} size={22} color={line.color} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{line.text}</Text>
              {line.sub ? (
                <Text variant="caption" color={e.type === 'descended' ? colors.torch : undefined}>
                  {line.sub}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </Card>
  );
}

function DragonBeat({ outcome, fx }: { outcome: StoredOutcome; fx: Fx }) {
  const dragon = useGame((s) => s.dragon);
  const summary = outcome.dragon!;
  const [ward, setWard] = useState(dragonHealth(summary.before));
  useSchedule(() => [
    [
      450,
      () => {
        setWard(dragonHealth(summary.after));
        if (summary.lines.length > 0) {
          play('dragonRoar', 0.8);
          haptics.heavy();
          fx.bump('shake');
          fx.flash(colors.ember);
        } else {
          play('hit', 0.7);
          haptics.impact();
        }
      },
    ],
  ]);
  const dealt = Math.max(0, Math.round((summary.after - summary.before) * 100));
  const revealed = useStagger(summary.lines.length, 900, 700);
  return (
    <Card testID="beat-dragon" glow={colors.ember}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="dragon" size={30} color={colors.ember} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.displayBold,
              fontSize: 24,
              lineHeight: 28,
              color: colors.bone,
            }}
            numberOfLines={1}
          >
            {dragon?.name ?? 'The dragon'}
          </Text>
          <Text variant="caption">{dealt > 0 ? `Your progress tore ${dealt}% from its ward.` : 'Its ward trembles.'}</Text>
        </View>
        <Text variant="stat" color={colors.ember}>
          {Math.round(ward * 100)}%
        </Text>
      </View>
      <ProgressBar value={ward} tone="hp" height={14} durationMs={1300} accessibilityLabel="Dragon ward" />
      {summary.lines.slice(0, revealed).map((line) => (
        <Animated.View key={line} entering={FadeInDown.springify()}>
          <Text variant="bodyStrong" color={colors.ember}>
            {line}
          </Text>
        </Animated.View>
      ))}
    </Card>
  );
}

// ── Final summary ──────────────────────────────────────────────────

function SummaryRow({ icon, color, children }: { icon: IconName; color: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.ms,
        alignItems: 'flex-start',
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

function Summary({ outcome }: { outcome: StoredOutcome }) {
  const unit = useGame((s) => s.profile.unit);
  const dungeon = useGame((s) => s.dungeon);
  const gains = statGainsOf(outcome);
  const levelUp = outcome.levelAfter > outcome.levelBefore;
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      testID="victory-summary"
      style={{
        maxHeight: '72%',
        backgroundColor: colors.glass,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.seam,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
      }}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.ms }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Tile label="XP" value={`+${outcome.xp.total}`} color={colors.torchHigh} />
          <Tile label="Gold" value={`+${outcome.gold}`} color={colors.torchHigh} />
          <Tile label={levelUp ? 'Level up' : 'Level'} value={String(outcome.levelAfter)} color={levelUp ? colors.torchHigh : colors.bone} />
        </View>
        {gains.length > 0 ? (
          <SummaryRow icon="bolt" color={colors.torch}>
            <Text variant="bodyStrong">{gains.map((g) => `+${g.amount} ${STAT_INFO[g.key].short}`).join(', ')}</Text>
          </SummaryRow>
        ) : null}
        {outcome.prs.length > 0 ? (
          <SummaryRow icon="trophy" color={colors.torchHigh}>
            {outcome.prs.slice(0, 4).map((pr) => (
              <Text key={`${pr.exerciseId}-${pr.kind}-${pr.setId}`} variant="body">
                <Text variant="bodyStrong">{findExercise(pr.exerciseId)?.name ?? 'Exercise'}</Text> {prSummary(pr, unit)}
              </Text>
            ))}
          </SummaryRow>
        ) : null}
        {outcome.loot.map((d) => (
          <SummaryRow key={d.item.id} icon="gift" color={rarityColors[d.item.rarity]}>
            <Text variant="bodyStrong" color={rarityColors[d.item.rarity]}>
              {d.item.name}
            </Text>
            <Text variant="caption">
              {RARITY_LABELS[d.item.rarity]} {SLOT_LABELS[d.item.slot].toLowerCase()}, power {d.item.power}
              {d.equipped ? ', equipped' : ''}
            </Text>
          </SummaryRow>
        ))}
        <SummaryRow icon="dungeon" color={colors.torch}>
          <Text variant="bodyStrong">
            Floor {dungeon.floor}
            {outcome.floorAfter > outcome.floorBefore ? `, down from ${outcome.floorBefore}` : ''}
          </Text>
          <Text variant="caption">
            {dungeon.roomsCleared >= BALANCE.dungeon.roomsPerFloor
              ? dungeon.sigils > 0
                ? 'The gate is open. Your next quest takes you deeper.'
                : 'The gate is sealed. A personal record will break it.'
              : `Room ${dungeon.roomsCleared + 1} of ${BALANCE.dungeon.roomsPerFloor} awaits.`}
          </Text>
        </SummaryRow>
        {outcome.dragon ? (
          <SummaryRow icon="dragon" color={colors.ember}>
            <Text variant="bodyStrong">Dragon ward at {Math.round(dragonHealth(outcome.dragon.after) * 100)}%</Text>
            <Text variant="caption">Only reaching your real goal can bring it to zero.</Text>
          </SummaryRow>
        ) : null}
        <Button title="Return to camp" icon="camp" size="lg" onPress={leave} testID="victory-return" />
      </ScrollView>
    </Animated.View>
  );
}
