import * as Updates from 'expo-updates';

let checking = false;

/**
 * Downloads a newer published version of the app, if there is one. When it
 * lands, `useUpdates().isUpdatePending` turns true and `restartIntoUpdate`
 * switches to it. Without that, the app still switches on its next cold start.
 */
export async function downloadAppUpdate() {
  if (__DEV__ || !Updates.isEnabled || checking) return;
  checking = true;
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or the update server is busy: try again next time.
  } finally {
    checking = false;
  }
}

export function restartIntoUpdate() {
  void Updates.reloadAsync().catch(() => undefined);
}
