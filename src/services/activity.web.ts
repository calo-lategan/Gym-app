import type { ActivityDay } from '@/domain/activity';
import type { WeighIn } from '@/domain/types';

/** Browsers have no step tracker to read; steps can still be typed in by hand. */
export type ActivityAvailability = 'ready' | 'needs-permission' | 'needs-update' | 'unavailable';

export async function activityAvailability(): Promise<ActivityAvailability> {
  return 'unavailable';
}

export async function connectActivity(): Promise<boolean> {
  return false;
}

export function openActivitySettings() {}

export async function readActivity(): Promise<ActivityDay[]> {
  return [];
}

export async function readWeighIns(): Promise<WeighIn[]> {
  return [];
}
