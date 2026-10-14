/**
 * Detects a 3D scene that took the whole app down. A native graphics crash
 * cannot be caught in JavaScript, so a marker is written while a scene starts
 * and cleared once it has rendered for a while. A marker still present on the
 * next launch means the app died while starting 3D.
 */
const STARTING_KEY = 'ironwyrm.scene-starting';

/** How long a scene must keep rendering before it counts as started. */
export const SCENE_SETTLE_MS = 8000;

export function markSceneStarting() {
  try {
    localStorage.setItem(STARTING_KEY, String(Date.now()));
  } catch {
    // Storage is best effort; without it the guard simply never trips.
  }
}

export function markSceneSettled() {
  try {
    localStorage.removeItem(STARTING_KEY);
  } catch {
    // ignore
  }
}

/** True once if the previous session ended while a scene was starting. */
export function takeSceneCrashFlag(): boolean {
  try {
    const pending = localStorage.getItem(STARTING_KEY) !== null;
    if (pending) localStorage.removeItem(STARTING_KEY);
    return pending;
  } catch {
    return false;
  }
}
