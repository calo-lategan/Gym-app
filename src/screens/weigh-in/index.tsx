import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { PageScroll } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { dayKeyOf, parseDayKey } from '@/domain/dates';
import { assessWeightRate, averageWeight, goalDirection, weeklyWeightChangePct } from '@/domain/science';
import { displayWeightValue, formatWeight, fromDisplayWeight } from '@/domain/strength';
import { goBack } from '@/navigation/back';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { latestBodyweight, logWeighIn } from '@/state/actions';
import { useGame, useHistory } from '@/state/stores';
import { colors, spacing } from '@/theme';

type Result = NonNullable<ReturnType<typeof logWeighIn>>;

export function WeighInScreen() {
  const unit = useGame((s) => s.profile.unit);
  const dragon = useGame((s) => s.dragon);
  const weighIns = useHistory((s) => s.weighIns);
  const [value, setValue] = useState(() => displayWeightValue(latestBodyweight(), unit));
  const [result, setResult] = useState<Result | null | 'saved'>(null);
  const today = dayKeyOf(new Date());
  const step = unit === 'kg' ? 0.1 : 0.2;

  const avg = useMemo(() => averageWeight(weighIns, today), [weighIns, today]);
  const rate = useMemo(() => weeklyWeightChangePct(weighIns, today), [weighIns, today]);
  const direction = dragon?.goal.kind === 'bodyweight' ? goalDirection('bodyweight', dragon.goal.start, dragon.goal.target) : null;
  const warning = direction ? assessWeightRate(direction, rate) : null;
  const recent = weighIns.slice(-5).reverse();

  const save = () => {
    const kg = fromDisplayWeight(value, unit);
    const outcome = logWeighIn(Math.round(kg * 100) / 100);
    if (outcome && outcome.newMilestones > 0) {
      play('statUp', 0.9);
      haptics.success();
    } else {
      play('coin', 0.6);
      haptics.light();
    }
    if (outcome?.lines.length) setTimeout(() => play('dragonRoar', 0.6), 500);
    setResult(outcome ?? 'saved');
  };

  if (result) {
    const r = result === 'saved' ? null : result;
    return (
      <PageScroll padTop={spacing.lg} testID="weigh-in-result">
        <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <Icon name="scale" size={36} color={colors.verdant} />
          <Text variant="title">{formatWeight(fromDisplayWeight(value, unit), unit)} logged</Text>
          {r && r.xp > 0 ? (
            <Text variant="bodyStrong" color={colors.torchHigh}>
              +{r.xp} XP{r.gold ? `, +${r.gold} gold` : ''}
            </Text>
          ) : null}
        </Animated.View>
        {r && r.newMilestones > 0 ? (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Panel tone="torch">
              <Text variant="heading">Milestone reached</Text>
              <Text variant="body">Your 7 day average moved toward your goal. Vitality +{r.newMilestones}.</Text>
            </Panel>
          </Animated.View>
        ) : null}
        {r?.lines.map((line) => (
          <Animated.View key={line} entering={FadeInDown.delay(450).springify()}>
            <Text variant="bodyStrong" color={colors.ember}>
              {line}
            </Text>
          </Animated.View>
        ))}
        <Button title="Done" size="lg" onPress={() => goBack('/')} testID="weigh-in-done" />
      </PageScroll>
    );
  }

  return (
    <PageScroll padTop={spacing.lg} testID="weigh-in-screen">
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Weigh in</Text>
        <Text variant="subhead">Same time each morning, before food. Only your 7 day average counts, so daily swings never matter.</Text>
      </View>
      <Stepper
        label={`Body weight (${unit})`}
        value={value}
        step={step}
        min={30}
        max={unit === 'kg' ? 300 : 660}
        format={(v) => v.toFixed(1)}
        onChange={setValue}
        testID="weigh-in-value"
      />
      <Button title="Log weight" icon="check" size="lg" onPress={save} testID="weigh-in-save" sound={null} />
      {avg !== null ? (
        <Text variant="caption">
          7 day average {formatWeight(avg, unit)}
          {rate !== null ? `, ${rate > 0 ? '+' : ''}${rate.toFixed(2)}% a week` : ''}.
        </Text>
      ) : null}
      {warning ? (
        <Panel tone={warning.level === 'danger' ? 'ember' : 'torch'}>
          <Text variant="bodyStrong">{warning.title}</Text>
          <Text variant="caption">{warning.detail}</Text>
        </Panel>
      ) : null}
      {recent.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="label">Recent</Text>
          {recent.map((w) => (
            <View key={w.at} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption">
                {parseDayKey(w.dayKey).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              <Text variant="caption" color={colors.bone}>
                {formatWeight(w.kg, unit)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </PageScroll>
  );
}
