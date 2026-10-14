jest.mock('expo-sqlite/localStorage/install', () => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
  return {};
});

import { recoverFromSceneCrash, SCENE_CRASH_NOTICE, updateSettings } from './actions';
import { markSceneSettled, markSceneStarting, takeSceneCrashFlag } from './scene-watch';
import { useGame } from './stores';

describe('scene crash guard', () => {
  beforeEach(() => {
    markSceneSettled();
    updateSettings({ graphics: 'full' });
    useGame.setState({ notices: [] });
  });

  it('reports a scene that never settled, once', () => {
    markSceneStarting();
    expect(takeSceneCrashFlag()).toBe(true);
    expect(takeSceneCrashFlag()).toBe(false);
  });

  it('ignores a scene that settled', () => {
    markSceneStarting();
    markSceneSettled();
    expect(takeSceneCrashFlag()).toBe(false);
  });

  it('turns 3D off and explains why after a crash while starting a scene', () => {
    markSceneStarting();
    expect(recoverFromSceneCrash()).toBe(true);
    expect(useGame.getState().settings.graphics).toBe('lite');
    expect(useGame.getState().notices).toEqual([SCENE_CRASH_NOTICE]);
  });

  it('leaves settings alone after a clean exit', () => {
    expect(recoverFromSceneCrash()).toBe(false);
    expect(useGame.getState().settings.graphics).toBe('full');
    expect(useGame.getState().notices).toEqual([]);
  });
});
