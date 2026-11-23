import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY_TRACK_SECTIONS } from '../../constants/copy-track';
import type { CelebrationAnchors } from '../../models/celebration';
import type { CopyTrackSection } from '../../models/copy-track';
import type { CopyTrackSpanReferences } from '../../models/copy-track-stage';
import {
  CopyTrackAnchor,
  CopyTrackSectionKind,
  CopyTrackStage,
} from '../../types/copy-track';
import {
  chooseCopyTrackSection,
  measureCopyTrackHost,
} from '../copy-track-stages';

const anchors: CelebrationAnchors = {
  composer: 'composer',
  starterList: 'starters',
  welcomeRegion: '[role="region"]',
};

const SCALE = 0.9;

/* SnowmanDelivery's references in native units: slides of `min`–`max` px at `scale`, the far point at 0.347 of the slide past its end. */
const referencesFor = (
  scale: number,
  min: number,
  max: number,
): CopyTrackSpanReferences => ({
  entry: 200,
  stretchable: {
    [CopyTrackAnchor.SpanStart]: { min: { x: 60, y: 0 }, max: { x: 60, y: 0 } },
    [CopyTrackAnchor.SpanEnd]: {
      min: { x: 60 + min / scale, y: 0 },
      max: { x: 60 + max / scale, y: 0 },
    },
    [CopyTrackAnchor.Far]: {
      min: { x: 60 + (min / scale) * 1.347, y: -62 },
      max: { x: 60 + (max / scale) * 1.347, y: -62 },
    },
  },
  overhang: 60,
  cardWidth: 140 / SCALE,
  cardHeight: 40 / SCALE,
});

const references = referencesFor(SCALE, 160, 460);
const mobileReferences = referencesFor(0.68, 100, 220);

const section = (kind: CopyTrackSectionKind): CopyTrackSection => ({
  kind,
  ...COPY_TRACK_SECTIONS[kind],
});

const SNOWMAN = [
  CopyTrackSectionKind.LedgeCard,
  CopyTrackSectionKind.RimCard,
  CopyTrackSectionKind.Rim,
  CopyTrackSectionKind.Platform,
].map(section);

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

const choose = (
  isMobile = false,
  sections = SNOWMAN,
  word?: DOMRect,
  variant = isMobile ? mobileReferences : references,
) => {
  const element = document.querySelector<HTMLElement>('.composer');
  const composer = element
    ? { element, rect: element.getBoundingClientRect() }
    : undefined;
  const scale = isMobile ? 0.68 : SCALE;
  const host = measureCopyTrackHost(anchors, {
    composer,
    isMobile,
    direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
    referenceCard: {
      width: variant.cardWidth * scale,
      height: variant.cardHeight * scale,
    },
    word,
  });
  return chooseCopyTrackSection(sections, host, () => variant, scale);
};

describe('chooseCopyTrackSection', () => {
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

    const chosen = choose();

    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.LedgeCard);
    expect(chosen?.plan.card?.element).toBe(buttons[0]);
    expect(chosen?.plan.side).toBe(1);
    expect(chosen?.plan.floor).toBeCloseTo(560 + 40 + 130 * SCALE);
    expect(chosen?.plan.anchors[CopyTrackAnchor.Copy]).toEqual({
      x: 400,
      y: 560,
    });
    expect(chosen?.plan.band.right).toBeLessThanOrEqual(1280 - 16);
  });

  it('places the stretchable anchors in proportion to the chosen span', () => {
    build();

    const plan = choose()?.plan;
    const start = plan?.anchors[CopyTrackAnchor.SpanStart]?.x ?? 0;
    const end = plan?.anchors[CopyTrackAnchor.SpanEnd]?.x ?? 0;
    const far = plan?.anchors[CopyTrackAnchor.Far]?.x ?? 0;

    expect(end - start).toBeCloseTo(plan?.span ?? 0, 6);
    expect((far - end) / (plan?.span ?? 1)).toBeCloseTo(0.347, 3);
  });

  it('mirrors travel in RTL and takes the card nearest the entrance side', () => {
    const { buttons } = build({ rtl: true });

    const plan = choose()?.plan;

    expect(plan?.stage).toBe(CopyTrackStage.Ledge);
    expect(plan?.side).toBe(-1);
    expect(plan?.card?.element).toBe(buttons[2]);
    expect(plan?.band.left).toBeGreaterThanOrEqual(16);
  });

  it('rides the composer rim when one card sits above it and the band is clear', () => {
    const { buttons } = build({
      heading: { left: 440, top: 150, width: 400, height: 40 },
      starters: { left: 380, top: 300, width: 140, height: 40 },
      cards: [{ left: 380, top: 300, width: 140, height: 40 }],
    });

    const chosen = choose();

    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.RimCard);
    expect(chosen?.plan.floor).toBeCloseTo(400 - 4 * SCALE);
    expect(chosen?.plan.card?.element).toBe(buttons[0]);
  });

  it('falls to the rim with no copy when the card above the rim is too low to grip', () => {
    build({
      starters: { left: 380, top: 340, width: 140, height: 40 },
      cards: [{ left: 380, top: 340, width: 140, height: 40 }],
    });

    const chosen = choose();

    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.Rim);
    expect(chosen?.plan.card).toBeUndefined();
    expect(chosen?.plan.anchors[CopyTrackAnchor.Copy]).toBeUndefined();
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

    const chosen = choose();

    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.Platform);
    expect(chosen?.plan.floor).toBeGreaterThan(500);
  });

  it('uses the rim with no copy when there are no starters', () => {
    build({ starters: null });

    expect(choose()?.section.kind).toBe(CopyTrackSectionKind.Rim);
  });

  it('tries the minimum span itself when the steps from the maximum skip it', () => {
    /* 165 px to 160 px is not a whole number of 8 px steps; only 160 px fits this page. */
    build({
      width: 480,
      composer: { left: 100, top: 400, width: 400, height: 100 },
      starters: null,
      cards: [],
    });

    const chosen = choose(
      false,
      [section(CopyTrackSectionKind.Rim)],
      undefined,
      referencesFor(SCALE, 160, 165),
    );

    expect(chosen?.plan.span).toBeCloseTo(160, 6);
  });

  it('chooses nothing when no band fits', () => {
    build({
      height: 560,
      heading: { left: 360, top: 320, width: 560, height: 40 },
      starters: null,
    });

    expect(choose()).toBeNull();
  });

  it('copies a composer word on the rim, at the word near edge', () => {
    build({ starters: null });

    const chosen = choose(
      false,
      [section(CopyTrackSectionKind.RimWord)],
      new DOMRect(420, 440, 48, 18),
    );

    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.RimWord);
    expect(chosen?.plan.anchors[CopyTrackAnchor.Copy]).toEqual({
      x: 420,
      y: 458,
    });
  });

  it('skips a word section when no word resolved', () => {
    build({ starters: null });

    expect(choose(false, [section(CopyTrackSectionKind.RimWord)])).toBeNull();
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

    const chosen = choose();

    expect(chosen?.plan.card).toBeUndefined();
    expect(chosen?.section.kind).toBe(CopyTrackSectionKind.Rim);
  });

  it.each([
    ['larger than 240 × 96', 260],
    ['narrower than the reference width band', 100],
  ])('never borrows a card %s', (_, width) => {
    build({
      cards: [{ left: 400, top: 520, width, height: 40 }],
      starters: { left: 400, top: 520, width, height: 40 },
    });

    expect(choose()?.plan.card).toBeUndefined();
  });

  it('never borrows a card outside the reference height band', () => {
    build({
      cards: [{ left: 400, top: 520, width: 140, height: 48 }],
      starters: { left: 400, top: 520, width: 140, height: 48 },
    });

    expect(choose()?.plan.card).toBeUndefined();
  });

  it('never borrows a card clipped by a scrolling ancestor', () => {
    const { buttons } = build();
    const list = buttons[0].parentElement as HTMLElement;
    list.style.overflowX = 'auto';
    vi.mocked(list.getBoundingClientRect).mockReturnValue(
      new DOMRect(450, 520, 480, 40),
    );

    expect(choose()?.plan.card?.element).not.toBe(buttons[0]);
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

    expect(choose()?.plan.card).toBeUndefined();
  });

  it.each([
    [false, 1280, 160, 460],
    [false, 1920, 160, 460],
    [true, 360, 100, 220],
    [true, 900, 100, 220],
  ])(
    'keeps the span within the authored references (mobile %s at %ipx)',
    (isMobile, width, min, max) => {
      const composerWidth = Math.min(560, width - 32);
      const left = (width - composerWidth) / 2;
      build({
        width,
        composer: { left, top: 400, width: composerWidth, height: 100 },
        heading: { left, top: 200, width: composerWidth, height: 40 },
        starters: null,
      });
      const span = choose(isMobile)?.plan.span ?? 0;

      expect(span).toBeGreaterThanOrEqual(min - 1e-6);
      expect(span).toBeLessThanOrEqual(max + 1e-6);
    },
  );
});
