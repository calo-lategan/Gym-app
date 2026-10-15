import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Field, parseNumber } from '@/components/field';
import { Icon, type IconName } from '@/components/icon';
import { Panel } from '@/components/panel';
import { ProgressBar } from '@/components/progress-bar';
import { Divider, PageScroll, Section } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { useActivitySync } from '@/hooks/use-activity-sync';
import { useEnergy } from '@/hooks/use-energy';
import { useToday } from '@/hooks/use-game-data';
import { usePurchases, useTrackerUnlocked } from '@/hooks/use-purchases';
import { TRACKER_SKU } from '@/services/billing';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { logFood, removeFood, setManualSteps } from '@/state/actions';
import { useActivity } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

/** Groups thousands, so 12345 reads as 12,345. */
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function minutesAgo(at: number | null): string {
  if (!at) return 'not yet';
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function BurnRow({ icon, label, detail, value }: { icon: IconName; label: string; detail?: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: 40 }}>
      <Icon name={icon} size={20} color={colors.ash} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </View>
      <Text variant="number">{grouped(value)}</Text>
    </View>
  );
}

function TrackerSource() {
  const today = useToday();
  const { availability, syncing, connect, sync, openSettings } = useActivitySync();
  const lastSync = useActivity((s) => s.lastSync);
  const manual = useActivity((s) => (s.days[today]?.source === 'manual' ? s.days[today].steps : null));

  if (availability === 'ready') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" style={{ flex: 1 }}>
          Steps and runs from Health Connect, synced {syncing ? 'now' : minutesAgo(lastSync)}.
        </Text>
        <Button title="Sync" icon="refresh" variant="ghost" size="sm" onPress={() => void sync()} testID="energy-sync" />
      </View>
    );
  }
  if (availability === 'needs-permission') {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption">Read your steps and runs from Samsung Health, Google Fit or your watch through Health Connect.</Text>
        <Button title="Connect step tracking" icon="walk" variant="secondary" onPress={() => void connect()} testID="energy-connect" />
      </View>
    );
  }
  if (availability === 'needs-update') {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption">Health Connect needs an update before it can share your steps.</Text>
        <Button title="Open Health Connect" variant="secondary" onPress={openSettings} />
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption">No step tracker on this device. Type today&apos;s steps from your watch or phone.</Text>
      <Stepper
        label="Steps today"
        value={manual ?? 0}
        step={500}
        min={0}
        max={60_000}
        format={grouped}
        onChange={(steps) => setManualSteps(today, steps)}
        testID="energy-steps"
      />
    </View>
  );
}

function Fuel() {
  const { plan, eatenKcal, eatenProteinG } = useEnergy();
  const left = plan.target - eatenKcal;
  return (
    <Panel tone="torch">
      <Text variant="label">Eat about</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text variant="display" testID="energy-target">
          {grouped(plan.target)}
        </Text>
        <Text variant="subhead">kcal today</Text>
      </View>
      <ProgressBar value={Math.min(1, eatenKcal / plan.target)} tone={left >= 0 ? 'good' : 'hp'} accessibilityLabel="Calories eaten" />
      <Text variant="caption">
        {grouped(eatenKcal)} eaten. {left >= 0 ? `${grouped(left)} left.` : `${grouped(-left)} over.`}
      </Text>
      <Divider />
      <Text variant="label">
        Protein {plan.proteinG[0]} to {plan.proteinG[1]} g
      </Text>
      <ProgressBar value={Math.min(1, eatenProteinG / plan.proteinG[0])} tone="frost" accessibilityLabel="Protein eaten" />
      <Text variant="caption">{eatenProteinG} g eaten.</Text>
      <Divider />
      <Text variant="caption">
        Maintenance is about {grouped(plan.maintenance)} kcal{plan.calibrated ? ', calibrated from your logs' : ''}.
      </Text>
      {plan.notes.map((note) => (
        <Text key={note} variant="caption" color={colors.bone}>
          {note}
        </Text>
      ))}
    </Panel>
  );
}

function FoodLog() {
  const { foods } = useEnergy();
  const [label, setLabel] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const kcalValue = parseNumber(energy);

  const add = () => {
    const entry = logFood({ kcal: kcalValue ?? 0, proteinG: parseNumber(protein) ?? 0, label });
    if (!entry) return;
    play('coin', 0.6);
    haptics.light();
    setLabel('');
    setEnergy('');
    setProtein('');
  };

  return (
    <Panel>
      <Field label="What" value={label} onChangeText={setLabel} placeholder="Chicken and rice" maxLength={40} testID="food-label" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Calories" value={energy} onChangeText={setEnergy} keyboardType="numeric" suffix="kcal" testID="food-kcal" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="numeric" suffix="g" testID="food-protein" />
        </View>
      </View>
      <Button title="Add" icon="plus" disabled={!kcalValue} onPress={add} testID="food-add" />
      {foods.map((f) => (
        <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{f.label}</Text>
            <Text variant="caption">
              {grouped(f.kcal)} kcal, {f.proteinG} g protein
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${f.label}`}
            hitSlop={8}
            onPress={() => removeFood(f.id)}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="trash" size={20} color={colors.dim} />
          </Pressable>
        </View>
      ))}
    </Panel>
  );
}

function Week() {
  const { week } = useEnergy();
  const peak = Math.max(1, ...week.flatMap((d) => [d.burn ?? 0, d.intake ?? 0]));
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: spacing.sm }}>
        {week.map((d) => (
          <View key={d.dayKey} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 96 }}>
              <View style={{ width: 8, height: `${((d.burn ?? 0) / peak) * 100}%`, borderRadius: radius.sm, backgroundColor: colors.ember }} />
              <View style={{ width: 8, height: `${((d.intake ?? 0) / peak) * 100}%`, borderRadius: radius.sm, backgroundColor: colors.verdant }} />
            </View>
            <Text variant="label">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${d.dayKey}T12:00:00`).getDay()]}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Text variant="caption" color={colors.ember}>
          Burned
        </Text>
        <Text variant="caption" color={colors.verdant}>
          Eaten
        </Text>
      </View>
    </Panel>
  );
}

function Unlock() {
  const { buy, restore, busy, priceOf } = usePurchases();
  const price = priceOf(TRACKER_SKU);
  return (
    <Panel tone="torch">
      <Text variant="heading">Unlock the calorie tracker</Text>
      {[
        'A daily calorie and protein target for your goal',
        'Adapts to your weigh-ins, steps, runs, workouts and recovery',
        'A quick food log that learns your real burn over two weeks',
        'A week view of what you burned and ate',
      ].map((line) => (
        <View key={line} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="check" size={18} color={colors.verdant} />
          <Text variant="body" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
      <Button
        title={price ? `Unlock for ${price}` : 'Unlock'}
        icon="unlock"
        size="lg"
        loading={busy === TRACKER_SKU}
        onPress={() => void buy(TRACKER_SKU)}
        testID="unlock-tracker"
      />
      <Button title="Restore purchase" variant="ghost" size="sm" loading={busy === 'restore'} onPress={() => void restore()} />
      <Text variant="caption">One payment, yours for good. Your burn and steps stay free.</Text>
    </Panel>
  );
}

export function EnergyScreen() {
  const { today, trackedToday } = useEnergy();
  const unlocked = useTrackerUnlocked();
  const todayKey = useToday();
  const steps = useActivity((s) => s.days[todayKey]?.steps ?? 0);

  return (
    <PageScroll testID="energy-screen">
      <Section title="Burned today" detail="An estimate that grows as you move.">
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text variant="display" testID="energy-burned">
              {grouped(today.total)}
            </Text>
            <Text variant="subhead">kcal today</Text>
          </View>
          <BurnRow icon="bed" label="Resting" detail="What your body burns to stay alive" value={today.resting} />
          <BurnRow icon="food" label="Daily living" detail="Digesting food and moving about" value={today.living} />
          <BurnRow
            icon="walk"
            label="Walking"
            detail={trackedToday ? `${grouped(steps)} steps, ${today.walkingKm} km` : 'No steps yet today'}
            value={today.walking}
          />
          {today.running > 0 ? <BurnRow icon="run" label="Running" value={today.running} /> : null}
          {today.gym > 0 ? <BurnRow icon="swords" label="Training" value={today.gym} /> : null}
          <Divider />
          <TrackerSource />
          {today.estimated ? (
            <Text variant="caption" color={colors.torch}>
              Add your height and birth year in Settings for a more accurate number.
            </Text>
          ) : null}
        </Panel>
      </Section>

      {unlocked ? (
        <>
          <Section title="Fuel">
            <Fuel />
          </Section>
          <Section title="Log food" detail="Rough numbers are fine; the target corrects itself from your weigh-ins.">
            <FoodLog />
          </Section>
          <Section title="This week">
            <Week />
          </Section>
        </>
      ) : (
        <Section title="Fuel">
          <Unlock />
        </Section>
      )}

      <Text variant="caption">
        Estimates use the Mifflin-St Jeor equation for resting burn, ACSM equations for walking and running, and exercise MET values for training.
        They are guidance, not medical advice.
      </Text>
    </PageScroll>
  );
}
