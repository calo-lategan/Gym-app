import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { PageScroll, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { MUSIC_SLOTS, musicSlot, resolveTrack, type MusicSlot, type SlotId } from '@/domain/music';
import { STORE_BUILD } from '@/hooks/use-purchases';
import { haptics } from '@/services/haptics';
import { hasTrack, previewTrack } from '@/services/music';
import { colors, radius, spacing, touch } from '@/theme';

const AVAILABLE = new Set(MUSIC_SLOTS.filter((s) => hasTrack(s.id)).map((s) => s.id));

function meanwhile(slot: MusicSlot): string {
  const track = slot.fallback ? resolveTrack(slot.id, AVAILABLE, true) : null;
  if (track === 'ambience') return 'Empty. The dungeon ambience plays meanwhile.';
  if (track) return `Empty. ${musicSlot(track).area} plays meanwhile.`;
  return 'Empty. Silent meanwhile.';
}

function SlotRow({ slot, playing, onToggle }: { slot: MusicSlot; playing: boolean; onToggle: () => void }) {
  const ready = AVAILABLE.has(slot.id);
  return (
    <View style={{ flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start', paddingVertical: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Stop' : 'Play'} ${slot.area}`}
        aria-disabled={!ready}
        disabled={!ready}
        onPress={onToggle}
        testID={`track-${slot.id}`}
        style={({ pressed }) => ({
          width: touch.min,
          height: touch.min,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: playing ? colors.torchDeep : pressed ? colors.slateHigh : colors.slate,
          borderWidth: 1,
          borderColor: playing ? colors.torch : colors.seam,
          opacity: ready ? 1 : 0.45,
        })}
      >
        <Icon name={playing ? 'stop' : ready ? 'play' : 'music'} size={20} color={ready ? colors.bone : colors.dim} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{slot.area}</Text>
        {STORE_BUILD ? null : (
          <>
            <Text variant="caption" color={ready ? colors.verdant : colors.ash}>
              {ready ? 'Composed.' : meanwhile(slot)} File: {slot.id}.mp3
            </Text>
            <Text variant="caption">{slot.brief}</Text>
          </>
        )}
      </View>
    </View>
  );
}

export function SoundtrackScreen() {
  const [playing, setPlaying] = useState<SlotId | null>(null);
  const slots = STORE_BUILD ? MUSIC_SLOTS.filter((s) => AVAILABLE.has(s.id)) : MUSIC_SLOTS;

  // Leaving the screen hands the music back to the area.
  useEffect(() => () => previewTrack(null), []);

  const toggle = (id: SlotId) => {
    const next = playing === id ? null : id;
    haptics.tap();
    previewTrack(next);
    setPlaying(next);
  };

  return (
    <PageScroll testID="soundtrack-screen">
      {STORE_BUILD ? null : (
        <Section title="Compose your own">
          <Panel>
            <Text variant="body">
              Every area of the game has a music slot. Export a looping track named after its slot, put it in assets/music, then publish an update. It
              plays here and in the game from then on.
            </Text>
            <Text variant="caption">
              MP3 or M4A at 44.1 kHz, about -16 LUFS, one to three minutes, with a seamless loop point. The guide in assets/music/README.md has the
              details.
            </Text>
          </Panel>
        </Section>
      )}
      <Section title="Areas" detail={`${AVAILABLE.size} of ${MUSIC_SLOTS.length} composed.`}>
        <Panel>
          {slots.length ? (
            slots.map((slot) => <SlotRow key={slot.id} slot={slot} playing={playing === slot.id} onToggle={() => toggle(slot.id)} />)
          ) : (
            <Text variant="caption">No music yet.</Text>
          )}
        </Panel>
      </Section>
    </PageScroll>
  );
}
