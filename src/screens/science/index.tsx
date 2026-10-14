import { useMemo } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Panel } from '@/components/panel';
import { PageScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { dayKeyOf } from '@/domain/dates';
import { formatWeight } from '@/domain/strength';
import { acuteChronicRatio, recoveryTargets, weeklySets, weeklyWeightChangePct, MUSCLE_LABELS, VOLUME_LANDMARKS } from '@/domain/science';
import type { MuscleGroup } from '@/domain/types';
import { latestBodyweight } from '@/state/actions';
import { useGame, useHistory } from '@/state/stores';
import { colors, spacing } from '@/theme';

function Topic({ icon, title, children, yours }: { icon: IconName; title: string; children: string; yours?: string | null }) {
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={icon} size={20} color={colors.torch} />
        <Text variant="heading" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text variant="body">{children}</Text>
      {yours ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Icon name="person" size={16} color={colors.verdant} />
          <Text variant="bodyStrong" color={colors.verdant} style={{ flex: 1 }}>
            {yours}
          </Text>
        </View>
      ) : null}
    </Panel>
  );
}

const REFERENCES = [
  'Schoenfeld, Ogborn and Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of Sports Sciences.',
  'Israetel, Hoffmann and Smith. Scientific Principles of Hypertrophy Training (volume landmarks).',
  'Gabbett (2016). The training-injury prevention paradox. British Journal of Sports Medicine.',
  'Morton et al. (2018). Protein supplementation and resistance training-induced gains in muscle mass and strength. British Journal of Sports Medicine.',
  'Helms, Aragon and Fitschen (2014). Evidence-based recommendations for natural bodybuilding contest preparation. Journal of the International Society of Sports Nutrition.',
  'Hooper and Mackinnon (1995). Monitoring overtraining in athletes. Sports Medicine.',
  'Epley (1985). Poundage chart, Boyd Epley Workout.',
];

export function ScienceScreen() {
  const sessions = useHistory((s) => s.sessions);
  const weighIns = useHistory((s) => s.weighIns);
  const profile = useGame((s) => s.profile);
  const today = dayKeyOf(new Date());
  const bodyweight = latestBodyweight();
  const targets = recoveryTargets(bodyweight, profile.focus, true);
  const acwr = useMemo(() => acuteChronicRatio(sessions, today), [sessions, today]);
  const rate = useMemo(() => weeklyWeightChangePct(weighIns, today), [weighIns, today]);
  const week = useMemo(() => weeklySets(sessions, today), [sessions, today]);
  const muscles = (Object.keys(week) as MuscleGroup[]).filter((m) => m !== 'core' && week[m] > 0);
  const fmt = (kg: number) => formatWeight(kg, profile.unit);

  return (
    <PageScroll testID="science-screen">
      <Text variant="subhead">
        The game is the fun part. Underneath, every number comes from sports science, scaled to your body and your history.
      </Text>

      <Topic
        icon="plan"
        title="How many sets"
        yours={
          muscles.length
            ? `Last 7 days: ${muscles.map((m) => `${MUSCLE_LABELS[m].toLowerCase()} ${Math.round(week[m])} of ${VOLUME_LANDMARKS[m].mev} to ${VOLUME_LANDMARKS[m].mrv}`).join(', ')}.`
            : null
        }
      >
        Muscle grows with weekly hard sets, up to a point. Around 10 or more sets per muscle a week beats fewer, and past each muscle&apos;s recovery limit (its MRV)
        extra sets stop paying. Your plan aims every muscle into that window and the app warns before a session would push you past it.
      </Topic>

      <Topic icon="up" title="Getting stronger, safely">
        Double progression: stay at a weight until you hit the top of the rep range on every set, then add the smallest jump the equipment allows. The app
        suggests the next weight and flags any jump of more than about 10% on upper body or 15% on lower body lifts.
      </Topic>

      <Topic
        icon="warning"
        title="Load spikes"
        yours={acwr !== null ? `Your last 7 days are at ${acwr.toFixed(2)} times your 4 week average${acwr > 1.5 ? ', a spike. Ease in this week.' : acwr < 0.8 ? '. Room to build up.' : ', a healthy range.'}` : null}
      >
        Injuries cluster when this week&apos;s training load jumps well above what you are used to. The app compares the last 7 days with your 4 week
        average (the acute to chronic workload ratio). Above about 1.5 is a red flag; 0.8 to 1.3 is the sweet spot.
      </Topic>

      <Topic icon="bed" title="Recovery between sessions">
        Big muscles such as chest, back and legs usually need 48 to 72 hours between hard sessions, smaller ones 24 to 48. If a plan would hit a muscle too
        soon, the app tells you and the check-in trims that work.
      </Topic>

      <Topic icon="heart" title="The daily check-in">
        Sleep, energy, stress and soreness predict how a session will go. On a rough day the app trims sets and load and lengthens rest, and swaps out moves
        that load a sore joint, so you still train instead of skipping.
      </Topic>

      <Topic
        icon="food"
        title="Fuel"
        yours={`For about ${fmt(bodyweight)}: ${targets.proteinG[0]} to ${targets.proteinG[1]} g of protein, about ${(targets.waterMl / 1000).toFixed(1)} litres of water and ${targets.sleepHours[0]} to ${targets.sleepHours[1]} hours of sleep.`}
      >
        Protein around 1.6 g per kg of body weight covers most lifters, with up to 2.2 g/kg helpful in a calorie deficit. Sleep is when most of the repair
        happens.
      </Topic>

      <Topic
        icon="scale"
        title="Body weight pace"
        yours={rate !== null ? `Your 7 day average is changing ${rate > 0 ? '+' : ''}${rate.toFixed(2)}% a week.` : 'Weigh in a few mornings a week to see your trend.'}
      >
        Losing about 0.5 to 1% of body weight a week keeps strength and muscle; faster usually costs both. When building, about 0.25 to 0.5% a week keeps fat
        gain modest. The app rewards progress on the 7 day average, so one odd morning never counts.
      </Topic>

      <Topic icon="trophy" title="What counts as a record">
        Heaviest weight, best estimated max (Epley, capped at 12 reps), more reps at a weight, a longer hold, or the same set at least 5% faster with at least a
        second per rep. Your very first set of an exercise only sets the baseline.
      </Topic>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label">Sources</Text>
        {REFERENCES.map((r) => (
          <Text key={r} variant="caption">
            {r}
          </Text>
        ))}
      </View>
    </PageScroll>
  );
}
