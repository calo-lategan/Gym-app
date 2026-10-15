import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';

import { toast } from '@/components/toast';
import { haptics } from '@/services/haptics';
import { loadStoreItems, purchase, settlePurchases, TRACKER_SKU, type StoreItem } from '@/services/billing';
import { play } from '@/services/sound';
import { recordTip, setTrackerOwned } from '@/state/actions';
import { useEntitlements } from '@/state/stores';

/**
 * Only the Google Play release sells the tracker. Development, preview and
 * internal builds, which cannot use Play Billing anyway, include it.
 */
export const STORE_BUILD = !__DEV__ && Updates.channel === 'production';

export function useTrackerUnlocked(): boolean {
  const owned = useEntitlements((s) => s.trackerOwned);
  return owned || !STORE_BUILD;
}

const unlockedToast = () => toast({ title: 'Calorie tracker unlocked', detail: 'Your daily target is ready.', icon: 'unlock', tone: 'verdant' });
const thanksToast = () => toast({ title: 'Thank you', detail: 'Your support keeps Ironwyrm free of ads.', icon: 'heart', tone: 'torch' });

/**
 * Quietly picks up purchases finished outside a purchase sheet: a pending
 * payment that cleared, or the unlock on a reinstalled or new phone.
 */
export async function settleStorePurchases(): Promise<void> {
  if (!STORE_BUILD) return;
  const { trackerOwned, trackerCleared, newTips } = await settlePurchases();
  if (trackerOwned && !useEntitlements.getState().trackerOwned) setTrackerOwned(true);
  for (let i = 0; i < newTips; i++) recordTip();
  // Only a payment that cleared while the app was closed is news; a reinstall restores silently.
  if (trackerCleared || newTips > 0) {
    play('lootLegendary');
    haptics.success();
    if (trackerCleared) unlockedToast();
    else thanksToast();
  }
}

/** Store prices plus buy and restore actions with their feedback. */
export function usePurchases() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadStoreItems().then((loaded) => {
      if (live) setItems(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  const buy = useCallback(async (sku: string) => {
    setBusy(sku);
    const outcome = await purchase(sku);
    setBusy(null);
    if (outcome === 'purchased') {
      play('lootLegendary');
      haptics.success();
      if (sku === TRACKER_SKU) {
        setTrackerOwned(true);
        unlockedToast();
      } else {
        recordTip();
        thanksToast();
      }
    } else if (outcome === 'pending') {
      toast({ title: 'Payment pending', detail: 'It unlocks as soon as Google Play confirms it.', icon: 'clock', tone: 'frost' });
    } else if (outcome === 'unavailable') {
      toast({ title: 'Purchases need the Google Play version', icon: 'warning', tone: 'ember' });
    } else if (outcome === 'failed') {
      toast({ title: 'The purchase did not go through', detail: 'Nothing was charged.', icon: 'warning', tone: 'ember' });
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy('restore');
    const { trackerOwned: owned, newTips } = await settlePurchases();
    setBusy(null);
    for (let i = 0; i < newTips; i++) recordTip();
    if (owned) {
      setTrackerOwned(true);
      haptics.success();
      toast({ title: 'Purchase restored', icon: 'unlock', tone: 'verdant' });
    } else {
      toast({ title: 'No purchase found on this Google account', icon: 'info', tone: 'frost' });
    }
  }, []);

  const priceOf = (sku: string) => items.find((i) => i.sku === sku)?.price ?? null;
  return { items, busy, buy, restore, priceOf };
}
