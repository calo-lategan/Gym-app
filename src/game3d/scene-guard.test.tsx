import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { WebGLRenderer } from 'three';

import { updateSettings } from '@/state/actions';

import { guardRender, SceneGuard } from './scene-guard';

// Hoisted above the imports by Jest.
jest.mock('expo-sqlite/localStorage/install', () => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
  return {};
});

function Healthy() {
  return <Text>scene</Text>;
}

function Broken(): never {
  throw new Error('Could not load the hero');
}

// The failure is remembered for the session, so these run in order.
describe('SceneGuard', () => {
  it('shows the backdrop instead of 3D in lite mode', async () => {
    updateSettings({ graphics: 'lite' });
    await render(
      <SceneGuard>
        <Healthy />
      </SceneGuard>,
    );
    expect(screen.getByTestId('scene-backdrop')).toBeTruthy();
    expect(screen.queryByText('scene')).toBeNull();
  });

  it('renders the scene when 3D is on', async () => {
    updateSettings({ graphics: 'full' });
    await render(
      <SceneGuard>
        <Healthy />
      </SceneGuard>,
    );
    expect(screen.getByText('scene')).toBeTruthy();
  });

  it('falls back to the backdrop with the reason when a scene throws', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(
      <SceneGuard>
        <Broken />
      </SceneGuard>,
    );
    expect(await screen.findByText('3D view unavailable. Could not load the hero')).toBeTruthy();
    quiet.mockRestore();
  });

  it('keeps later scenes on the backdrop after a failure', async () => {
    await render(
      <SceneGuard>
        <Healthy />
      </SceneGuard>,
    );
    expect(screen.queryByText('scene')).toBeNull();
    expect(screen.getByTestId('scene-backdrop')).toBeTruthy();
  });
});

describe('guardRender', () => {
  it('stops a frame error from escaping the renderer', () => {
    const gl = {
      render: () => {
        throw new Error('shader failed');
      },
    } as unknown as WebGLRenderer;
    guardRender(gl);
    expect(() => gl.render({} as never, {} as never)).not.toThrow();
  });
});
