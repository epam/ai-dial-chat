/* Decorative SVG has no accessible role; these structural queries inspect inert art. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateWitches } from '../../../utils/halloween-witch-animation';
import { getWitchTargets } from '../../../utils/halloween-witch-targets';
import HalloweenWitches from '../HalloweenWitches';

const state = vi.hoisted(() => ({
  mobile: false,
  reduced: false,
  listeners: new Set<() => void>(),
}));
vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    const anchors = testAnchors({
      composer: 'composer',
      starterList: 'starters',
    });
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: state.mobile, anchors }),
    };
  },
);
vi.mock('../../../../hooks/useReducedMotion', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useReducedMotion: () =>
      useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener);
          return () => state.listeners.delete(listener);
        },
        () => state.reduced,
      ),
  };
});
vi.mock('../../../utils/halloween-witch-animation', () => ({
  animateWitches: vi.fn(),
}));
vi.mock('../../../utils/halloween-witch-targets', () => ({
  getWitchTargets: vi.fn(),
}));
const descriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const stop = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  state.listeners.clear();
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(),
  });
  vi.mocked(animateWitches).mockReturnValue(stop);
  vi.mocked(getWitchTargets).mockReturnValue({
    width: 1280,
    height: 800,
    buttons: [],
  });
});
afterEach(() => {
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.restoreAllMocks();
});
describe('witch scene integration', () => {
  it.each([true, false])(
    'connects two witches and the broom-only story without changing input, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <>
          <textarea aria-label="Message" defaultValue="Draft" />
          <HalloweenWitches />
        </>,
      );
      await waitFor(() => expect(animateWitches).toHaveBeenCalledOnce());
      expect(vi.mocked(animateWitches).mock.calls[0][0].actors).toHaveLength(2);
      expect(vi.mocked(animateWitches).mock.calls[0][1].actors).toHaveLength(2);
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
        'value',
        'Draft',
      );
      expect(
        view.container
          .querySelector('[data-halloween-scene="witches"]')
          ?.hasAttribute('inert'),
      ).toBe(true);
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );
  it.each(['reduced', 'unsupported'])(
    'uses static art without geometry or animation when %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'unsupported')
        Reflect.deleteProperty(Element.prototype, 'animate');
      const view = render(<HalloweenWitches />);
      expect(
        view.container.querySelector('[data-witch-static]'),
      ).not.toBeNull();
      expect(view.container.querySelectorAll('svg')).toHaveLength(2);
      expect(getWitchTargets).not.toHaveBeenCalled();
      expect(animateWitches).not.toHaveBeenCalled();
    },
  );
  it('does not start deferred work after immediate interaction', async () => {
    render(<HalloweenWitches />);
    fireEvent.keyDown(window, { key: 'a' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getWitchTargets).not.toHaveBeenCalled();
    expect(animateWitches).not.toHaveBeenCalled();
  });
  it('prepares once through StrictMode rehearsal and cancels a motion change', async () => {
    const view = render(
      <StrictMode>
        <HalloweenWitches />
      </StrictMode>,
    );
    await waitFor(() => expect(animateWitches).toHaveBeenCalledOnce());
    expect(getWitchTargets).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = true;
      state.listeners.forEach((listener) => listener());
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-ended="true"]')).not.toBeNull();
  });
});
