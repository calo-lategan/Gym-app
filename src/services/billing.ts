import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';

/**
 * Google Play Billing. Product ids must match the in-app products created in
 * Play Console (see docs/release-android.md). Billing only works in builds
 * installed from Google Play, internal testing included.
 */
export const TRACKER_SKU = 'calorie_tracker';
export const TIP_SKUS = ['tip_small', 'tip_medium', 'tip_large'] as const;

export interface StoreItem {
  sku: string;
  title: string;
  price: string;
}

export type PurchaseOutcome = 'purchased' | 'pending' | 'cancelled' | 'failed' | 'unavailable';

let connection: Promise<boolean> | null = null;
/** The product whose purchase sheet is open; its result belongs to purchase(), not settlePurchases(). */
let buying: string | null = null;
let settling: Promise<SettledPurchases> | null = null;

function connect(): Promise<boolean> {
  connection ??= initConnection().then(
    () => true,
    () => {
      connection = null;
      return false;
    },
  );
  return connection;
}

export async function loadStoreItems(): Promise<StoreItem[]> {
  if (!(await connect())) return [];
  try {
    const products = await fetchProducts({ skus: [TRACKER_SKU, ...TIP_SKUS], type: 'in-app' });
    return (products ?? []).map((p) => ({ sku: p.id, title: p.title, price: p.displayPrice }));
  } catch {
    return [];
  }
}

/** Runs the Play purchase sheet and resolves once the store reports back. */
export async function purchase(sku: string): Promise<PurchaseOutcome> {
  if (!(await connect())) return 'unavailable';
  const consumable = isTip(sku);
  buying = sku;
  return new Promise<PurchaseOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: PurchaseOutcome) => {
      if (settled) return;
      settled = true;
      buying = null;
      updated.remove();
      failed.remove();
      resolve(outcome);
    };
    const updated = purchaseUpdatedListener((bought) => {
      if (bought.productId !== sku) return;
      if (bought.purchaseState === 'pending') {
        finish('pending');
        return;
      }
      // Tips are consumed so they can be given again; the tracker unlock is acknowledged and kept.
      finishTransaction({ purchase: bought, isConsumable: consumable })
        .catch(() => undefined)
        .finally(() => finish('purchased'));
    });
    const failed = purchaseErrorListener((error) => finish(isUserCancelledError(error) ? 'cancelled' : 'failed'));
    requestPurchase({ request: { google: { skus: [sku] }, apple: { sku } }, type: 'in-app' }).catch((error: unknown) =>
      finish(isUserCancelledError(error) ? 'cancelled' : 'failed'),
    );
  });
}

export interface SettledPurchases {
  /** This Google account owns the tracker unlock: bought here, on another phone, or before a reinstall. */
  trackerOwned: boolean;
  /** The unlock was paid but never finished, such as a pending payment that cleared while the app was closed. */
  trackerCleared: boolean;
  /** Tips paid that no purchase sheet was waiting for, counted once. */
  newTips: number;
}

/**
 * Finishes purchases the store completed while no purchase sheet was open and
 * reports what the account owns. Google refunds a purchase that is not
 * acknowledged within three days, so store builds run this on every launch.
 */
export function settlePurchases(): Promise<SettledPurchases> {
  settling ??= settle().finally(() => {
    settling = null;
  });
  return settling;
}

async function settle(): Promise<SettledPurchases> {
  const result: SettledPurchases = { trackerOwned: false, trackerCleared: false, newTips: 0 };
  if (!(await connect())) return result;
  try {
    for (const p of await getAvailablePurchases()) {
      if (p.purchaseState !== 'purchased' || p.productId === buying) continue;
      if (p.productId === TRACKER_SKU) {
        result.trackerOwned = true;
        if ('isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid === false) {
          result.trackerCleared = true;
          await finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
        }
      } else if (isTip(p.productId)) {
        // A tip the store still lists was never consumed, so it has not been counted yet.
        await finishTransaction({ purchase: p, isConsumable: true }).then(
          () => (result.newTips += 1),
          () => undefined,
        );
      }
    }
  } catch {
    // Offline or the store is busy: the next launch tries again.
  }
  return result;
}

function isTip(sku: string): boolean {
  return (TIP_SKUS as readonly string[]).includes(sku);
}
