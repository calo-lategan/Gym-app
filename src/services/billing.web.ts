/** The web build has no store; purchases report unavailable. */
export const TRACKER_SKU = 'calorie_tracker';
export const TIP_SKUS = ['tip_small', 'tip_medium', 'tip_large'] as const;

export interface StoreItem {
  sku: string;
  title: string;
  price: string;
}

export type PurchaseOutcome = 'purchased' | 'pending' | 'cancelled' | 'failed' | 'unavailable';

export async function loadStoreItems(): Promise<StoreItem[]> {
  return [];
}

export async function purchase(): Promise<PurchaseOutcome> {
  return 'unavailable';
}

export interface SettledPurchases {
  trackerOwned: boolean;
  trackerCleared: boolean;
  newTips: number;
}

export async function settlePurchases(): Promise<SettledPurchases> {
  return { trackerOwned: false, trackerCleared: false, newTips: 0 };
}
