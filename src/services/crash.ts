import { create } from 'zustand';

type Handler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): Handler;
  setGlobalHandler(handler: Handler): void;
}

/** A fatal error caught after the app was on screen. */
export const useCrash = create<{ error: Error | null }>(() => ({ error: null }));

let onScreen = false;

export function markAppOnScreen() {
  onScreen = true;
}

export function clearCrash() {
  useCrash.setState({ error: null });
}

/**
 * In a release build a fatal JavaScript error closes the app. Once the app is
 * on screen, show the crash screen instead so the error can be read and shared.
 * Errors before that still go to React Native, since there is nothing to show
 * them on yet.
 */
export function installCrashHandler() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (__DEV__ || !errorUtils) return;
  const fallback = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal || !onScreen) {
      fallback(error, isFatal);
      return;
    }
    if (!useCrash.getState().error) useCrash.setState({ error: error instanceof Error ? error : new Error(String(error)) });
  });
}
