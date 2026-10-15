import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { Field } from '@/components/field';
import { Panel } from '@/components/panel';
import { Divider, PageScroll, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { toast } from '@/components/toast';
import { ToggleRow } from '@/components/toggle-row';
import { HERO_CLASSES } from '@/domain/game/progression';
import { ALL_EQUIPMENT, EQUIPMENT_LABELS } from '@/domain/substitution';
import type { EquipmentId, Experience, Focus } from '@/domain/types';
import { usePurchases } from '@/hooks/use-purchases';
import { pickBackupText, shareBackup } from '@/services/backup';
import { TIP_SKUS } from '@/services/billing';
import { notificationPermission, requestNotificationPermission, sendTestReminder } from '@/services/notifications';
import {
  exportData,
  regenerateProgram,
  renameHero,
  resetAll,
  restoreBackup,
  setEquipment,
  setHeroClass,
  setRemindersEnabled,
  updateProfile,
  updateSettings,
} from '@/state/actions';
import { useEntitlements, useGame } from '@/state/stores';
import { colors } from '@/theme';

const FOCI: { id: Focus; label: string }[] = [
  { id: 'grow', label: 'Build muscle' },
  { id: 'fit', label: 'Fitter and healthier' },
  { id: 'lean', label: 'Lose fat' },
];
const LEVELS: { id: Experience; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

function confirm(title: string, message: string, action: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`) ?? true) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

function EquipmentChips({ kind }: { kind: 'gymEquipment' | 'homeEquipment' }) {
  const selected = useGame((s) => s.profile[kind]);
  const toggle = (q: EquipmentId) => setEquipment(kind, selected.includes(q) ? selected.filter((x) => x !== q) : [...selected, q]);
  return (
    <ChipRow>
      {ALL_EQUIPMENT.map((q) => (
        <Chip key={q} label={EQUIPMENT_LABELS[q]} selected={selected.includes(q)} onPress={() => toggle(q)} testID={`${kind}-${q}`} />
      ))}
    </ChipRow>
  );
}

const TIP_TITLES: Record<(typeof TIP_SKUS)[number], string> = {
  tip_small: 'Buy the smith a tea',
  tip_medium: 'Buy the smith a meal',
  tip_large: 'Fund a new blade',
};

function SupportSection() {
  const { buy, busy, priceOf } = usePurchases();
  const tipsGiven = useEntitlements((s) => s.tipsGiven);
  const available = TIP_SKUS.some((sku) => priceOf(sku));
  return (
    <Section title="Support Ironwyrm" detail="Made by one person, with no ads. If it helps you train, a tip keeps it going.">
      <Panel>
        {available ? (
          TIP_SKUS.map((sku) => (
            <Button
              key={sku}
              title={`${TIP_TITLES[sku]}, ${priceOf(sku)}`}
              icon="gift"
              variant="secondary"
              loading={busy === sku}
              onPress={() => void buy(sku)}
              testID={`tip-${sku}`}
            />
          ))
        ) : (
          <Text variant="caption">Tips work in the Google Play version of Ironwyrm.</Text>
        )}
        {tipsGiven > 0 ? (
          <Text variant="caption" color={colors.torch}>
            Thank you for {tipsGiven === 1 ? 'your tip' : `${tipsGiven} tips`}.
          </Text>
        ) : null}
        <Button title="Calorie tracker" icon="food" variant="ghost" onPress={() => router.push('/energy')} testID="settings-energy" />
      </Panel>
    </Section>
  );
}

export function SettingsScreen() {
  const hero = useGame((s) => s.hero);
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const schedule = useGame((s) => s.schedule);
  const [name, setName] = useState(hero.name);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useEffect(() => {
    void notificationPermission().then(setPermission);
  }, []);

  const changeFocus = (focus: Focus) => {
    if (focus === profile.focus) return;
    updateProfile({ focus });
    confirm(
      'Rebuild your plan for this focus?',
      'Sets, reps and exercise choice change with your focus. Your history and records stay.',
      'Rebuild',
      () => {
        regenerateProgram();
        toast({ title: 'Plan rebuilt', icon: 'plan', tone: 'torch' });
      },
    );
  };

  const exportAll = async () => {
    try {
      if (!(await shareBackup(exportData()))) toast({ title: 'Sharing is not available on this device', tone: 'ember', icon: 'warning' });
    } catch {
      toast({ title: 'Could not save the backup', tone: 'ember', icon: 'warning' });
    }
  };

  const restore = () =>
    confirm(
      'Restore a backup?',
      'Everything on this phone is replaced by the backup you pick: hero, history, records and plan.',
      'Choose backup',
      async () => {
        const text = await pickBackupText().catch(() => null);
        if (text === null) return;
        const result = restoreBackup(text);
        if (result.ok)
          toast({ title: 'Backup restored', detail: `${result.sessions} workouts are back in your battle log.`, icon: 'check', tone: 'verdant' });
        else toast({ title: 'Nothing was changed', detail: result.reason, icon: 'warning', tone: 'ember' });
      },
      true,
    );

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <PageScroll testID="settings-screen">
      <Section title="Hero">
        <Panel>
          <Field label="Name" value={name} onChangeText={setName} maxLength={24} testID="settings-name" />
          {name.trim() && name.trim() !== hero.name ? (
            <Button title="Save name" size="sm" onPress={() => renameHero(name)} testID="settings-save-name" />
          ) : null}
          <Text variant="label">Class</Text>
          <ChipRow>
            {HERO_CLASSES.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={hero.heroClass === c.id}
                onPress={() => setHeroClass(c.id)}
                testID={`settings-class-${c.id}`}
              />
            ))}
          </ChipRow>
        </Panel>
      </Section>

      <Section title="Training">
        <Panel>
          <Text variant="label">Focus</Text>
          <ChipRow>
            {FOCI.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={profile.focus === f.id}
                onPress={() => changeFocus(f.id)}
                testID={`settings-focus-${f.id}`}
              />
            ))}
          </ChipRow>
          <Text variant="label">Experience</Text>
          <ChipRow>
            {LEVELS.map((l) => (
              <Chip key={l.id} label={l.label} selected={profile.experience === l.id} onPress={() => updateProfile({ experience: l.id })} />
            ))}
          </ChipRow>
          <Text variant="label">Units</Text>
          <ChipRow>
            <Chip label="Kilograms" selected={profile.unit === 'kg'} onPress={() => updateProfile({ unit: 'kg' })} testID="settings-kg" />
            <Chip label="Pounds" selected={profile.unit === 'lb'} onPress={() => updateProfile({ unit: 'lb' })} testID="settings-lb" />
          </ChipRow>
          <Divider />
          <Button title="Change goal" icon="target" variant="secondary" onPress={() => router.push('/slay?mode=change')} testID="settings-goal" />
        </Panel>
      </Section>

      <Section title="Gym equipment" detail="Plans and swaps only use what is ticked.">
        <EquipmentChips kind="gymEquipment" />
      </Section>
      <Section title="Home equipment" detail="Used for home workouts, so there is always a way to train. Nothing ticked means body weight only.">
        <EquipmentChips kind="homeEquipment" />
      </Section>

      <Section title="Reminders">
        <Panel>
          <ToggleRow
            label="Training day reminders"
            detail="Change the time and days on the Plan tab."
            icon="bell"
            value={schedule.remindersEnabled}
            onValueChange={async (on) => {
              setRemindersEnabled(on);
              if (on) {
                const ok = await requestNotificationPermission();
                setPermission(ok ? 'granted' : await notificationPermission());
              }
            }}
            testID="settings-reminders"
          />
          {permission === 'denied' && Platform.OS !== 'web' ? (
            <>
              <Text variant="caption" color={colors.ember}>
                Notifications are blocked for Ironwyrm, so reminders cannot reach you.
              </Text>
              <Button title="Open system settings" variant="secondary" size="sm" onPress={() => void Linking.openSettings()} />
            </>
          ) : null}
          {Platform.OS !== 'web' ? (
            <Button
              title="Send a test reminder"
              variant="ghost"
              size="sm"
              onPress={async () => {
                if (await requestNotificationPermission()) {
                  await sendTestReminder();
                  toast({ title: 'Test reminder on its way', detail: 'It arrives in a few seconds.', icon: 'bell', tone: 'torch' });
                }
              }}
            />
          ) : (
            <Text variant="caption">Reminders work in the Android and iOS app.</Text>
          )}
        </Panel>
      </Section>

      <Section title="Feel">
        <Panel>
          <ToggleRow
            label="Sound effects"
            icon="sound"
            value={settings.sound}
            onValueChange={(sound) => updateSettings({ sound })}
            testID="settings-sound"
          />
          <ToggleRow
            label="Dungeon ambience"
            detail="Low background drone at camp."
            icon="moon"
            value={settings.ambience}
            onValueChange={(ambience) => updateSettings({ ambience })}
          />
          <ToggleRow label="Haptics" icon="vibrate" value={settings.haptics} onValueChange={(haptics) => updateSettings({ haptics })} />
          <ToggleRow
            label="Full 3D graphics"
            detail="Turn off to save battery: scenes become lit backdrops."
            icon="sparkles"
            value={settings.graphics === 'full'}
            onValueChange={(full) => updateSettings({ graphics: full ? 'full' : 'lite' })}
            testID="settings-graphics"
          />
          <ToggleRow label="24-hour clock" icon="clock" value={settings.use24h} onValueChange={(use24h) => updateSettings({ use24h })} />
        </Panel>
      </Section>

      <SupportSection />

      <Section title="Your data" detail="Everything stays on this phone. No account, no tracking.">
        <Panel>
          <Button title="Export a backup" icon="export" variant="secondary" onPress={exportAll} testID="settings-export" />
          <Button title="Restore a backup" icon="refresh" variant="secondary" onPress={restore} testID="settings-restore" />
          <Button
            title="Start over"
            icon="trash"
            variant="danger"
            onPress={() =>
              confirm(
                'Start over?',
                'Your hero, history, records and plan are deleted from this phone. This cannot be undone.',
                'Delete everything',
                resetAll,
                true,
              )
            }
            testID="settings-reset"
          />
        </Panel>
      </Section>

      <Section title="About">
        <Panel>
          <Button title="The science behind the plan" icon="brain" variant="ghost" onPress={() => router.push('/science')} />
          <Button title="Privacy" icon="lock" variant="ghost" onPress={() => router.push('/privacy')} testID="settings-privacy" />
          <Text variant="caption">
            Ironwyrm {version}. Characters and dungeon art by Kay Lousberg (KayKit, CC0). Grenze Gotisch typeface under the SIL Open Font License.
            Sound effects made for this game.
          </Text>
          <Text variant="caption">
            Training advice here is general guidance, not medical advice. Stop and see a professional if something hurts beyond normal training
            soreness.
          </Text>
        </Panel>
      </Section>
    </PageScroll>
  );
}
