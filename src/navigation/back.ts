import { router, type Href } from 'expo-router';

/**
 * Closes the current screen. When it was opened directly (a deep link or a
 * web reload) there is nothing to go back to, so it goes to `fallback`.
 */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
