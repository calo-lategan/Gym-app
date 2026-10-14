import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
  icon?: IconName;
  tone?: 'torch' | 'ember' | 'verdant' | 'frost';
}

const useToasts = create<{ queue: ToastMessage[] }>(() => ({ queue: [] }));
let nextId = 1;

/** Short, non-blocking confirmation. Errors that need action stay inline instead. */
export function toast(message: Omit<ToastMessage, 'id'>) {
  useToasts.setState((s) => ({ queue: [...s.queue, { ...message, id: nextId++ }] }));
}

export function ToastHost() {
  const queue = useToasts((s) => s.queue);
  const current = queue[0];
  const insets = useSafeAreaInsets();
  const visible = current;

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => useToasts.setState((s) => ({ queue: s.queue.slice(1) })), 3200);
    return () => clearTimeout(t);
  }, [current]);

  if (!visible) return null;
  const accent =
    visible.tone === 'ember' ? colors.ember : visible.tone === 'verdant' ? colors.verdant : visible.tone === 'frost' ? colors.frost : colors.torch;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, zIndex: 50 }}>
      <Animated.View
        key={visible.id}
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(180)}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          gap: spacing.ms,
          alignItems: 'center',
          padding: spacing.ms,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: `${accent}88`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
        }}
      >
        <Icon name={visible.icon ?? 'sparkles'} size={22} color={accent} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{visible.title}</Text>
          {visible.detail ? <Text variant="caption">{visible.detail}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}
