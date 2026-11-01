import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationAnchors } from '../../../models/celebration';
import { SnowmanStage } from '../../types/new-year';
import { glideEndSpeed, HEAD_FLIGHT } from '../snowman-delivery-rig';
import { getSnowmanDeliveryTargets } from '../snowman-delivery-targets';

const anchors: CelebrationAnchors = {
  composer: 'composer',
  starterList: 'starters',
  welcomeRegion: '[role="region"]',
};

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const place = (element: HTMLElement, { left, top, width, height }: Box) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(left, top, width, height));

interface Fixture {
  width?: number;
  height?: number;
  rtl?: boolean;
  heading?: Box | null;
  composer?: Box | null;
  starters?: Box | null;
  cards?: Box[];
}

const build = ({
  width = 1280,
  height = 900,
  rtl = false,
  heading = { left: 440, top: 200, width: 400, height: 40 },
  composer = { left: 360, top: 400, width: 560, height: 100 },
  starters = { left: 400, top: 520, width: 480, height: 40 },
  cards = [
    { left: 400, top: 520, width: 140, height: 40 },
    { left: 560, top: 520, width: 140, height: 40 },
    { left: 720, top: 520, width: 140, height: 40 },
  ],
}: Fixture = {}) => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    width,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    height,
  );
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.style.direction = rtl ? 'rtl' : 'ltr';
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  document.body.append(region);
  if (heading) {
    const h1 = document.createElement('h1');
    h1.textContent = 'How can I help?';
    region.append(h1);
    place(h1, heading);
  }
  if (composer) {
    const input = document.createElement('div');
    input.className = 'composer';
    /* jsdom does not inherit `direction`; the stage reads it from the composer. */
    input.style.direction = rtl ? 'rtl' : 'ltr';
    region.append(input);
    place(input, composer);
  }
  const buttons: HTMLButtonElement[] = [];
  if (starters) {
    const list = document.createElement('ul');
    list.className = 'starters';
    region.append(list);
    place(list, starters);
    cards.forEach((box, index) => {
      const button = document.createElement('button');
      button.textContent = `Starter ${index + 1}`;
      list.append(button);
      place(button, box);
      buttons.push(button);
    });
  }
  return { region, buttons };
};

const expectHeadMatchesSled = (
  targets: ReturnType<typeof getSnowmanDeliveryTargets>,
) => {
  const { distance, seconds } = targets.headFlight;
  expect(seconds).toBeGreaterThanOrEqual(HEAD_FLIGHT.min);
  expect(seconds).toBeLessThanOrEqual(HEAD_FLIGHT.max);
  expect(distance / seconds).toBeCloseTo(glideEndSpeed(targets.slideLength), 6);
};

describe('getSnowmanDeliveryTargets', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('dir');
    document.documentElement.style.direction = '';
    vi.restoreAllMocks();
  });

  it('stages a ledge under starters that sit below the composer', () => {
    const { buttons } = build();

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.Ledge);
    expect(targets.card?.element).toBe(buttons[0]);
    expect(targets.dir).toBe(1);
    /* Seated on the copy, his head clears the row: card height plus 130 units. */
    expect(targets.floor).toBeCloseTo(560 + 40 + 130 * 0.9);
    expect(targets.watched).toContain(buttons[0]);
    expect(targets.treeX).toBeGreaterThan(targets.stanceX);
    expect(targets.treeX).toBeLessThan(1280 - 16);
    expectHeadMatchesSled(targets);
  });

  it('mirrors travel in RTL and takes the card nearest the entrance side', () => {
    const { buttons } = build({ rtl: true });

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.Ledge);
    expect(targets.dir).toBe(-1);
    expect(targets.card?.element).toBe(buttons[2]);
    expect(targets.treeX).toBeLessThan(targets.stanceX);
    expect(targets.treeX).toBeGreaterThan(16);
  });

  it('rides the composer rim when one card sits above it and the band is clear', () => {
    const { buttons } = build({
      heading: { left: 440, top: 150, width: 400, height: 40 },
      starters: { left: 380, top: 300, width: 140, height: 40 },
      cards: [{ left: 380, top: 300, width: 140, height: 40 }],
    });

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.Rim);
    expect(targets.floor).toBeCloseTo(400 - 4 * 0.9);
    expect(targets.card?.element).toBe(buttons[0]);
    expectHeadMatchesSled(targets);
  });

  it('uses a drawn sled when the card above the rim is too low to grip standing', () => {
    build({
      starters: { left: 380, top: 340, width: 140, height: 40 },
      cards: [{ left: 380, top: 340, width: 140, height: 40 }],
    });

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.RimSled);
    expect(targets.card).toBeNull();
  });

  it('moves to a platform when a crowded starter row sits on the rim', () => {
    build({
      starters: { left: 360, top: 340, width: 560, height: 40 },
      cards: [0, 1, 2, 3, 4].map((index) => ({
        left: 360 + index * 112,
        top: 340,
        width: 100,
        height: 40,
      })),
    });

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.Platform);
    expect(targets.card).toBeNull();
    expect(targets.floor).toBeGreaterThan(500);
  });

  it('uses a drawn sled on the rim without starters', () => {
    build({ starters: null });

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.mode).toBe(SnowmanStage.RimSled);
    expect(targets.card).toBeNull();
    expect(targets.sled.width).toBeCloseTo(70 * 0.9);
  });

  it('falls back to the static still when no band fits', () => {
    build({
      height: 560,
      heading: { left: 360, top: 320, width: 560, height: 40 },
      starters: null,
    });

    expect(getSnowmanDeliveryTargets(anchors, false).mode).toBe(
      SnowmanStage.Static,
    );
  });

  it.each([
    [
      'disabled',
      (button: HTMLButtonElement) => {
        button.disabled = true;
      },
    ],
    [
      'aria-disabled',
      (button: HTMLButtonElement) =>
        button.setAttribute('aria-disabled', 'true'),
    ],
    ['focused', (button: HTMLButtonElement) => button.focus()],
    [
      'transformed',
      (button: HTMLButtonElement) => {
        button.style.transform = 'scale(1.1)';
      },
    ],
    [
      'inside an aria-hidden subtree',
      (button: HTMLButtonElement) =>
        button.parentElement?.setAttribute('aria-hidden', 'true'),
    ],
    [
      'a celebration snapshot',
      (button: HTMLButtonElement) => {
        button.dataset.celebrationSnapshot = 'true';
      },
    ],
    [
      'too many nodes',
      (button: HTMLButtonElement) =>
        button.append(
          ...Array.from({ length: 40 }, () => document.createElement('span')),
        ),
    ],
  ])('never borrows a card that is %s', (_, spoil) => {
    const { buttons } = build({
      cards: [{ left: 400, top: 520, width: 140, height: 40 }],
      starters: { left: 400, top: 520, width: 140, height: 40 },
    });
    spoil(buttons[0]);

    const targets = getSnowmanDeliveryTargets(anchors, false);

    expect(targets.card).toBeNull();
    expect(targets.mode).toBe(SnowmanStage.RimSled);
  });

  it('never borrows a card larger than 240 × 96', () => {
    build({
      cards: [{ left: 400, top: 520, width: 260, height: 40 }],
      starters: { left: 400, top: 520, width: 260, height: 40 },
    });

    expect(getSnowmanDeliveryTargets(anchors, false).card).toBeNull();
  });

  it('never borrows a card clipped by a scrolling ancestor', () => {
    const { buttons } = build();
    const list = buttons[0].parentElement as HTMLElement;
    list.style.overflowX = 'auto';
    vi.mocked(list.getBoundingClientRect).mockReturnValue(
      new DOMRect(450, 520, 480, 40),
    );

    expect(getSnowmanDeliveryTargets(anchors, false).card?.element).not.toBe(
      buttons[0],
    );
  });

  it('scans at most four starter buttons', () => {
    const { buttons } = build({
      cards: [0, 1, 2, 3, 4].map((index) => ({
        left: 300 + index * 150,
        top: 520,
        width: 140,
        height: 40,
      })),
      starters: { left: 300, top: 520, width: 740, height: 40 },
    });
    buttons.slice(0, 4).forEach((button) => {
      button.disabled = true;
    });

    expect(getSnowmanDeliveryTargets(anchors, false).card).toBeNull();
  });

  it.each([
    [false, 1280, 160, 460],
    [false, 1920, 160, 460],
    [true, 360, 100, 220],
    [true, 900, 100, 220],
  ])(
    'keeps the slide within the travel bounds (mobile %s at %ipx)',
    (isMobile, width, min, max) => {
      const composerWidth = Math.min(560, width - 32);
      const left = (width - composerWidth) / 2;
      build({
        width,
        composer: { left, top: 400, width: composerWidth, height: 100 },
        heading: { left, top: 200, width: composerWidth, height: 40 },
        starters: null,
      });

      const targets = getSnowmanDeliveryTargets(anchors, isMobile);

      expect(targets.mode).not.toBe(SnowmanStage.Static);
      expect(targets.slideLength).toBeGreaterThanOrEqual(min);
      expect(targets.slideLength).toBeLessThanOrEqual(max);
      expectHeadMatchesSled(targets);
    },
  );
});
