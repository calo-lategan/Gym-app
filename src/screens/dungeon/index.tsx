import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { Panel } from '@/components/panel';
import { ProgressBar } from '@/components/progress-bar';
import { Divider, Section, TabScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { isoWeekKey, parseDayKey } from '@/domain/dates';
import { BALANCE } from '@/domain/game/balance';
import { canAttemptBoss, describeChallenge } from '@/domain/game/boss';
import { canSlay, dragonHealth, describeGoal } from '@/domain/game/dragon';
import { bossNameForFloor, isBossFloor, zoneForFloor } from '@/domain/game/dungeon';
import { findExercise } from '@/domain/exercises';
import { formatWeight } from '@/domain/strength';
import type { DungeonState, JournalEntry } from '@/domain/types';
import { useDragonProgress, useToday, useTodayStatus } from '@/hooks/use-game-data';
import { useGame } from '@/state/stores';
import { colors, fonts, radius, spacing } from '@/theme';

const ROW = 92;
const NODE = 46;
const AHEAD = 6;
const BEHIND = 2;

/** Gentle zigzag so the descent reads as a winding path, not a list. */
const offsetFor = (floor: number) => Math.sin(floor * 1.25) * 0.28;

interface MapNode {
  floor: number;
  state: 'cleared' | 'current' | 'ahead';
  boss: boolean;
  zoneStart: boolean;
}

function mapNodes(dungeon: DungeonState): MapNode[] {
  const first = Math.max(1, dungeon.floor - BEHIND);
  const nodes: MapNode[] = [];
  for (let f = first; f <= dungeon.floor + AHEAD; f++) {
    nodes.push({
      floor: f,
      state: f < dungeon.floor ? 'cleared' : f === dungeon.floor ? 'current' : 'ahead',
      boss: isBossFloor(f),
      zoneStart: (f - 1) % BALANCE.dungeon.bossEvery === 0,
    });
  }
  return nodes;
}

function Segment({ from, to, lit }: { from: { x: number; y: number }; to: { x: number; y: number }; lit: boolean }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - 1,
        width: length,
        height: 0,
        borderTopWidth: 3,
        borderStyle: lit ? 'solid' : 'dashed',
        borderColor: lit ? colors.torchDeep : colors.seam,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/** The descent: a winding path of floors with the hero's position lit. */
function DescentMap({ dungeon }: { dungeon: DungeonState }) {
  const [width, setWidth] = useState(0);
  const nodes = useMemo(() => mapNodes(dungeon), [dungeon]);
  const rooms = BALANCE.dungeon.roomsPerFloor;
  const point = (i: number) => ({ x: width / 2 + offsetFor(nodes[i].floor) * width, y: i * ROW + ROW / 2 });
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: nodes.length * ROW }}>
      {width > 0
        ? nodes.slice(1).map((n, i) => <Segment key={`s${n.floor}`} from={point(i)} to={point(i + 1)} lit={nodes[i + 1].state !== 'ahead'} />)
        : null}
      {width > 0
        ? nodes.map((n, i) => {
            const p = point(i);
            const current = n.state === 'current';
            const zone = zoneForFloor(n.floor);
            const icon: IconName = n.state === 'cleared' ? 'check' : n.boss ? 'skull' : current ? 'swords' : 'lock';
            const tint = n.state === 'cleared' ? colors.verdant : n.boss ? colors.ember : current ? colors.torchHigh : colors.dim;
            const size = current ? NODE + 14 : n.boss ? NODE + 4 : NODE;
            const labelLeft = p.x > width / 2;
            return (
              <View key={n.floor} pointerEvents="none">
                {n.zoneStart ? (
                  <Text
                    variant="label"
                    color={zone.light}
                    style={{ position: 'absolute', top: i * ROW - 2, left: 0, right: 0, textAlign: 'center', opacity: n.state === 'ahead' ? 0.7 : 1 }}
                  >
                    {zone.name.toUpperCase()}
                  </Text>
                ) : null}
                <View
                  accessible
                  accessibilityLabel={`Floor ${n.floor}${n.boss ? ', guardian' : ''}${current ? ', you are here' : n.state === 'cleared' ? ', cleared' : ''}`}
                  style={{
                    position: 'absolute',
                    left: p.x - size / 2,
                    top: p.y - size / 2,
                    width: size,
                    height: size,
                    borderRadius: size / 3,
                    borderCurve: 'continuous',
                    transform: [{ rotate: '45deg' }],
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: current ? 'rgba(242,169,59,0.18)' : colors.stone,
                    borderWidth: current ? 3 : 2,
                    borderColor: tint,
                    boxShadow: current
                      ? '0 0 26px rgba(242,169,59,0.55)'
                      : n.boss && n.state === 'ahead'
                        ? '0 0 16px rgba(232,85,62,0.35)'
                        : undefined,
                  }}
                >
                  <View style={{ transform: [{ rotate: '-45deg' }] }}>
                    <Icon name={icon} size={current ? 24 : 18} color={tint} />
                  </View>
                </View>
                <View
                  style={{
                    position: 'absolute',
                    top: p.y - 20,
                    ...(labelLeft ? { right: width - p.x + size / 2 + 14 } : { left: p.x + size / 2 + 14 }),
                    alignItems: labelLeft ? 'flex-end' : 'flex-start',
                    maxWidth: width / 2 - size / 2 - 20,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.displayBold,
                      fontSize: current ? 22 : 18,
                      lineHeight: current ? 26 : 22,
                      color: current ? colors.bone : n.state === 'cleared' ? colors.ash : colors.dim,
                    }}
                  >
                    Floor {n.floor}
                  </Text>
                  <Text variant="label" color={n.boss ? colors.ember : current ? colors.torch : colors.dim} numberOfLines={1}>
                    {n.boss
                      ? n.floor === dungeon.floor && dungeon.boss
                        ? dungeon.boss.name
                        : bossNameForFloor(n.floor)
                      : current
                        ? `Room ${Math.min(dungeon.roomsCleared + 1, rooms)} of ${rooms}`
                        : n.state === 'cleared'
                          ? 'Cleared'
                          : `${rooms} rooms`}
                  </Text>
                </View>
              </View>
            );
          })
        : null}
    </View>
  );
}

const JOURNAL_ICONS: Record<JournalEntry['kind'], { icon: IconName; color: string }> = {
  room: { icon: 'swords', color: colors.torch },
  gate: { icon: 'lock', color: colors.ember },
  descend: { icon: 'stairs', color: colors.torchHigh },
  boss: { icon: 'skull', color: colors.ember },
  loot: { icon: 'gift', color: colors.arcane },
  pr: { icon: 'trophy', color: colors.torchHigh },
  level: { icon: 'star', color: colors.torchHigh },
  dragon: { icon: 'dragon', color: colors.ember },
  streak: { icon: 'camp', color: colors.ember },
  weight: { icon: 'scale', color: colors.verdant },
};

function journalDate(dayKey: string, today: string): string {
  if (dayKey === today) return 'Today';
  const d = parseDayKey(dayKey);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function DungeonScreen() {
  const dungeon = useGame((s) => s.dungeon);
  const dragon = useGame((s) => s.dragon);
  const unit = useGame((s) => s.profile.unit);
  const today = useToday();
  const status = useTodayStatus();
  const { goal, current, progress } = useDragonProgress();
  const zone = zoneForFloor(dungeon.floor);
  const rooms = BALANCE.dungeon.roomsPerFloor;
  const boss = dungeon.boss;
  const bossOpen = boss ? canAttemptBoss(boss, isoWeekKey(today)) : false;
  const nextBossFloor = Math.ceil(dungeon.floor / BALANCE.dungeon.bossEvery) * BALANCE.dungeon.bossEvery;
  const fmt = (kg: number) => formatWeight(kg, unit);

  const gate = isBossFloor(dungeon.floor)
    ? boss
      ? { icon: 'skull' as const, color: colors.ember, text: `${boss.name} guards the stairs. Beat its challenge to descend.` }
      : {
          icon: 'swords' as const,
          color: colors.torch,
          text: `Clear ${rooms - dungeon.roomsCleared} more ${rooms - dungeon.roomsCleared === 1 ? 'room' : 'rooms'} to reach the guardian.`,
        }
    : dungeon.sigils > 0
      ? {
          icon: 'unlock' as const,
          color: colors.verdant,
          text:
            dungeon.roomsCleared >= rooms
              ? 'The seal is broken. Your next completed quest descends.'
              : 'The seal is broken. Clear the rooms to descend.',
        }
      : { icon: 'lock' as const, color: colors.torch, text: 'The gate is sealed. Set any personal record on this floor to break it.' };

  const journal = dungeon.journal.slice(0, 24);

  return (
    <TabScreen title="Dungeon" subtitle={`${zone.name}, floor ${dungeon.floor}`} testID="dungeon-screen">
      <Panel tone="glass">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={gate.icon} size={20} color={gate.color} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {gate.text}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {Array.from({ length: rooms }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: i < dungeon.roomsCleared ? colors.torch : 'rgba(0,0,0,0.4)',
                borderWidth: 1,
                borderColor: colors.seam,
              }}
            />
          ))}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              marginLeft: spacing.xs,
              backgroundColor: dungeon.sigils > 0 || (isBossFloor(dungeon.floor) && !boss) ? colors.verdant : colors.ember,
            }}
          />
        </View>
        <Text variant="caption">
          {isBossFloor(dungeon.floor)
            ? 'This is a guardian floor.'
            : `Next guardian on floor ${nextBossFloor}, ${nextBossFloor - dungeon.floor} ${nextBossFloor - dungeon.floor === 1 ? 'floor' : 'floors'} down.`}{' '}
          Every completed quest clears a room. Records break gate seals.
        </Text>
      </Panel>

      {boss ? (
        <Panel tone="ember" testID="boss-panel">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="skull" size={26} color={colors.ember} />
            <View style={{ flex: 1 }}>
              <Text variant="label" color={colors.ember}>
                MINIBOSS
              </Text>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 28, color: colors.bone }}>{boss.name}</Text>
            </View>
          </View>
          <Text variant="bodyStrong">{describeChallenge(boss.challenge, fmt)}</Text>
          <Text variant="caption">
            Built from your own numbers, just past your best. One attempt a week, as the last exercise of a quest.
            {boss.attempts > 0 ? ` Attempts so far: ${boss.attempts}.` : ''}
          </Text>
          {bossOpen ? (
            <Button
              title="Challenge it today"
              icon="swords"
              variant="danger"
              onPress={() => router.push('/check-in?mode=gym&boss=1')}
              sound="bossRoar"
              testID="dungeon-challenge-boss"
              disabled={status.doneToday}
            />
          ) : (
            <Text variant="caption" color={colors.torch}>
              You have faced it this week. It returns on Monday with a fresh challenge.
            </Text>
          )}
        </Panel>
      ) : null}

      {dragon && goal ? (
        <Panel
          onPress={() => router.push('/lair')}
          testID="dragon-panel"
          accessibilityLabel={`${dragon.name}, ward ${Math.round(dragonHealth(progress) * 100)} percent. Enter the lair.`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="dragon" size={28} color={colors.ember} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, color: colors.bone }}>{dragon.name}</Text>
              <Text variant="caption">{dragon.epithet}</Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.dim} />
          </View>
          <ProgressBar value={dragonHealth(progress)} tone="hp" height={10} accessibilityLabel="Dragon ward" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text variant="caption" style={{ flex: 1 }}>
              {describeGoal(goal, fmt, goal.exerciseId ? findExercise(goal.exerciseId)?.name : undefined)}
              {current !== null && goal.kind !== 'sessions' ? `. Now ${fmt(current)}.` : current !== null ? `. ${current} done.` : '.'}
            </Text>
            <Text variant="label" color={canSlay(progress) ? colors.verdant : colors.ember}>
              {canSlay(progress) ? 'Ward broken' : `Ward ${Math.round(dragonHealth(progress) * 100)}%`}
            </Text>
          </View>
        </Panel>
      ) : null}

      <Section title="The descent" detail="Floors below grow darker. Every fifth floor has a guardian.">
        <DescentMap dungeon={dungeon} />
      </Section>

      <Section title="Journal">
        {journal.length === 0 ? (
          <Text variant="subhead">Your deeds will be written here. Complete a quest to clear your first room.</Text>
        ) : (
          <Panel>
            {journal.map((entry, i) => {
              const meta = JOURNAL_ICONS[entry.kind];
              const showDate = i === 0 || journal[i - 1].dayKey !== entry.dayKey;
              return (
                <View key={entry.id} style={{ gap: spacing.xs }}>
                  {showDate ? (
                    <>
                      {i > 0 ? <Divider /> : null}
                      <Text variant="label" color={colors.dim}>
                        {journalDate(entry.dayKey, today)}
                      </Text>
                    </>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={meta.icon} size={16} color={meta.color} />
                    </View>
                    <Text variant="body" style={{ flex: 1 }}>
                      {entry.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Panel>
        )}
      </Section>
    </TabScreen>
  );
}
