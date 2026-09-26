/* Decorative artwork deliberately has no accessible role or name. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HALLOWEEN_SCENE_DURATIONS } from '../../../constants/halloween';
import { HALLOWEEN_LABELS } from '../../../constants/labels';
import { halloweenEvent as halloween } from '../../../event';
import { HalloweenScene } from '../../../types/halloween';
import * as history from '../../../utils/halloween-secret-history';
import HalloweenBurstOverlay from '../HalloweenBurstOverlay';

const scenes = [
  HalloweenScene.Cauldron,
  HalloweenScene.Mimic,
  HalloweenScene.Bowling,
  HalloweenScene.Mummy,
];

describe('message-only Halloween scenes', () => {
  it('keeps the existing spider surprise and eleven pumpkin scenes in separate pools', () => {
    expect(halloween.secretTrigger?.sceneIds).toEqual([
      HalloweenScene.Spiders,
      ...scenes,
    ]);
    expect(halloween.clickSceneIds).toHaveLength(11);
    halloween.secretTrigger?.sceneIds.forEach((id) =>
      expect(halloween.clickSceneIds).not.toContain(id),
    );
  });

  it.each(scenes)(
    'announces %s with a secret hint and cleans up after its animation',
    (id) => {
      const scene = halloween.scenes.find((candidate) => candidate.id === id);
      expect(scene?.durationMs).toBe(HALLOWEEN_SCENE_DURATIONS[id]);
      const key = scene?.labelId as keyof typeof HALLOWEEN_LABELS;
      expect(HALLOWEEN_LABELS[key]).toContain('{{phrase}}');
      expect(HALLOWEEN_LABELS[key]).toContain('start-page chat');
    },
  );

  it.each(scenes)(
    'keeps %s decorative with stable placement and unique paint references',
    (burst) => {
      const { container, rerender } = render(
        <HalloweenBurstOverlay burst={burst} />,
      );
      const art = container.querySelector('svg');
      const position = art?.getAttribute('style');
      expect(art?.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(art?.getAttribute('focusable')).toBe('false');
      expect(
        container.querySelectorAll('button, a, input, [tabindex]'),
      ).toHaveLength(0);
      rerender(<HalloweenBurstOverlay burst={burst} />);
      expect(container.querySelector('svg')?.getAttribute('style')).toBe(
        position,
      );
      rerender(
        <>
          <HalloweenBurstOverlay burst={burst} />
          <HalloweenBurstOverlay burst={burst} />
        </>,
      );
      const ids = Array.from(
        container.querySelectorAll('[id]'),
        (node) => node.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      container
        .querySelectorAll('[fill], [stroke], [clip-path]')
        .forEach((node) => {
          for (const attribute of ['fill', 'stroke', 'clip-path']) {
            const reference = node
              .getAttribute(attribute)
              ?.match(/^url\(#(.+)\)$/)?.[1];
            if (reference) expect(ids).toContain(reference);
          }
        });
    },
  );
});

describe('secret history motion preference and cleanup', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'animate',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalAnimate)
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  const setup = (reduced: boolean) => {
    const events = new EventTarget();
    const media = {
      matches: reduced,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(),
    });
    const stop = vi.fn();
    const animate = vi
      .spyOn(history, 'animateSecretSceneHistory')
      .mockReturnValue(stop);
    return {
      stop,
      animate,
      reduce: () =>
        act(() => {
          media.matches = true;
          events.dispatchEvent(new Event('change'));
        }),
    };
  };

  it.each(scenes)('does not borrow history for reduced-motion %s', (burst) => {
    const { animate } = setup(true);
    render(<HalloweenBurstOverlay burst={burst} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('restores history when motion preference changes during a scene', () => {
    const { stop, animate, reduce } = setup(false);
    render(<HalloweenBurstOverlay burst={HalloweenScene.Cauldron} />);
    expect(animate).toHaveBeenCalledOnce();
    reduce();
    expect(stop).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
  });

  it('cancels borrowing on scene replacement and unmount', () => {
    const { stop, animate } = setup(false);
    const { rerender, unmount } = render(
      <HalloweenBurstOverlay burst={HalloweenScene.Cauldron} />,
    );
    rerender(
      <HalloweenBurstOverlay
        burst={HalloweenScene.Cauldron}
        key="replacement"
      />,
    );
    expect(stop).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledTimes(2);
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
