import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import {
  type ComposerSource,
  measureComposer,
} from '../../utils/composer-target';
import { ElfFireworksMode } from '../types/new-year';
import { elfPalm } from './gift-wrapping-rig';

/** Measured stage of one fireworks activation, in viewport pixels. */
export interface ElfFireworksTargets {
  /** Viewport width. */
  width: number;
  /** Viewport height. */
  height: number;
  /** Whether the composer is right-to-left. */
  rtl: boolean;
  /** Which launch button the story uses. */
  mode: ElfFireworksMode;
  /** CSS pixels per native elf unit. */
  scale: number;
  /** Viewport x direction from the composer's start edge to its end edge. */
  dir: 1 | -1;
  /** Viewport y of the composer rim the elf stands on. */
  floor: number;
  /** Viewport x of the composer's start edge. */
  startEdge: number;
  /** Composer width, the length of the rim. */
  span: number;
  /** The measured composer; `null` only in the static mode. */
  composer: ComposerSource | null;
  /** The borrowed send button, or `null` for a drawn detonator. */
  button: CelebrationSnapshotTarget | null;
  /** Host elements whose mutation or movement cancels the scene. */
  watched: HTMLElement[];
}

/** Elf size in CSS pixels per native unit. */
export const ELF_FIREWORKS_SCALE = { desktop: 0.72, mobile: 0.58 } as const;
/** Height of the drawn detonator box, in native units. */
export const DETONATOR_SIZE = { width: 40, height: 34 } as const;

/* The elf, his cane and a jump onto the button must fit above the composer. */
const HEADROOM = { desktop: 170, mobile: 140 } as const;
const MIN_COMPOSER_WIDTH = { desktop: 300, mobile: 240 } as const;
const BUTTON_SCAN_LIMIT = 16;
const MAX_BUTTON_NODES = 40;
const BUTTON_MIN = { width: 24, height: 24 };
const BUTTON_MAX = { width: 120, height: 64 };

/** Longest candy cane, in CSS pixels, that can fish the button out. */
export const MAX_CANE_LENGTH = 200;

/** The fishing pose: arm angles, body lean and the hook's forward offset from the palm, in native units. */
export const ELF_FISH_POSE = {
  arm: [84, 6] as [number, number],
  lean: 12,
  hookOffset: 8,
} as const;

/** Distances along the rim, in CSS pixels from its start edge, where each beat of the story happens. */
export interface ElfFireworksRimLayout {
  /** Where the sack stands. */
  sack: number;
  /** Where the elf stands to toss rockets. */
  toss: number;
  /** Rack spots, farthest first; the last one holds the dud. */
  rack: number[];
  /** Where the launch button lands on the rim. */
  land: number;
  /** Where the elf stands to press it by hand. */
  press: number;
  /** Where the elf stands to kick it home. */
  kick: number;
}

/** Returns the rim layout for a rim of `span` pixels, an elf scale and a launch button width. */
export const getElfFireworksRimLayout = (
  span: number,
  scale: number,
  buttonWidth: number,
  rocketCount: number,
): ElfFireworksRimLayout => {
  const sack = span * 0.55;
  const toss = sack - 26 * scale;
  const rackStart = span * 0.08;
  const rackEnd = toss - 46 * scale;
  const land = sack + 19 * scale + buttonWidth / 2 + 8;
  return {
    sack,
    toss,
    rack: Array.from(
      { length: rocketCount },
      (_, i) =>
        rackStart + ((rackEnd - rackStart) * i) / Math.max(1, rocketCount - 1),
    ),
    land,
    press: land + buttonWidth / 2 + 10 * scale,
    kick: land - buttonWidth / 2 - 13 * scale,
  };
};

/** The palm in the fishing pose, relative to the feet in native units. */
export const fishingHand = (): [number, number] => {
  const [x, y] = elfPalm(...ELF_FISH_POSE.arm);
  const a = (ELF_FISH_POSE.lean * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const MAX_ANCESTORS = 24;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

const matchesSafely = (element: Element, selector: string) => {
  try {
    return element.matches(selector);
  } catch {
    /* An engine without the pseudo-class cannot report the state. */
    return false;
  }
};

const isClipped = (element: HTMLElement, rect: DOMRect) => {
  let ancestor = element.parentElement;
  for (let depth = 0; ancestor && depth < MAX_ANCESTORS; depth++) {
    const style = getComputedStyle(ancestor);
    const clipX = CLIPPING.test(style.overflowX);
    const clipY = CLIPPING.test(style.overflowY);
    if (clipX || clipY) {
      const clip = ancestor.getBoundingClientRect();
      if (
        (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
        (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
      )
        return true;
    }
    ancestor = ancestor.parentElement;
  }
  return false;
};

/* A disabled send button still makes a fine plunger: only its copy moves. */
const isEligibleButton = (
  element: HTMLElement,
  rect: DOMRect,
  composer: DOMRect,
): boolean => {
  if (!element.isConnected || !rect.width || !rect.height) return false;
  const style = getComputedStyle(element);
  return !(
    style.display === 'none' ||
    style.visibility !== 'visible' ||
    style.opacity === '0' ||
    (style.transform !== 'none' && style.transform !== '') ||
    element.closest(EXCLUDED) ||
    element.matches('[aria-expanded="true"]') ||
    element.contains(document.activeElement) ||
    matchesSafely(element, ':hover') ||
    matchesSafely(element, ':active') ||
    typeof element.animate !== 'function' ||
    rect.width < BUTTON_MIN.width ||
    rect.width > BUTTON_MAX.width ||
    rect.height < BUTTON_MIN.height ||
    rect.height > BUTTON_MAX.height ||
    rect.left < composer.left - 1 ||
    rect.right > composer.right + 1 ||
    rect.top < composer.top - 1 ||
    rect.bottom > composer.bottom + 1 ||
    element.getElementsByTagName('*').length + 1 > MAX_BUTTON_NODES ||
    isClipped(element, rect)
  );
};

/** Returns the composer's inline-end-most bottom button: the send button in a chat composer. */
const findSendButton = (
  composer: ComposerSource,
  dir: 1 | -1,
  scale: number,
  floor: number,
): CelebrationSnapshotTarget | null => {
  const buttons = composer.element.getElementsByTagName('button');
  const count = Math.min(buttons.length, BUTTON_SCAN_LIMIT);
  let best: CelebrationSnapshotTarget | null = null;
  const endOf = (rect: DOMRect) => (dir > 0 ? rect.right : -rect.left);
  /* The end-most rendered button is the send button; when it cannot be
     borrowed, no other button stands in for it. */
  for (let i = 0; i < count; i++) {
    const element = buttons[i];
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (
      !best ||
      endOf(rect) > endOf(best.rect) + 2 ||
      (Math.abs(endOf(rect) - endOf(best.rect)) <= 2 &&
        rect.bottom > best.rect.bottom)
    )
      best = { element, rect };
  }
  if (!best || !isEligibleButton(best.element, best.rect, composer.rect))
    return null;
  const { rect } = best;
  const center = (rect.left + rect.right) / 2;
  const along =
    dir > 0 ? center - composer.rect.left : composer.rect.right - center;
  const [handX, handY] = fishingHand();
  const fishAt = along - (handX + ELF_FISH_POSE.hookOffset) * scale;
  /* The send button sits past the landing spot; the cane must reach its top. */
  const { press } = getElfFireworksRimLayout(
    composer.rect.width,
    scale,
    rect.width,
    1,
  );
  const cane = rect.top - (floor + handY * scale);
  if (fishAt < press + 12 * scale || cane > MAX_CANE_LENGTH || cane < 8)
    return null;
  return best;
};

/** Measures the composer rim and its send button once; falls back to a drawn detonator, or to the still without a composer. */
export const getElfFireworksTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): ElfFireworksTargets => {
  const layout = isMobile ? 'mobile' : 'desktop';
  const scale = ELF_FIREWORKS_SCALE[layout];
  const { width, height, rtl, composer } = measureComposer(anchors.composer, {
    minWidth: MIN_COMPOSER_WIDTH[layout],
    headroom: HEADROOM[layout],
  });
  const dir: 1 | -1 = rtl ? -1 : 1;
  if (!composer)
    return {
      width,
      height,
      rtl,
      mode: ElfFireworksMode.Static,
      scale,
      dir,
      floor: height,
      startEdge: 0,
      span: 0,
      composer: null,
      button: null,
      watched: [],
    };
  const { rect } = composer.source;
  const floor = rect.top - 3;
  const button = findSendButton(composer.source, dir, scale, floor);
  return {
    width,
    height,
    rtl,
    mode: button ? ElfFireworksMode.Button : ElfFireworksMode.Detonator,
    scale,
    dir,
    floor,
    startEdge: dir > 0 ? rect.left : rect.right,
    span: rect.width,
    composer: composer.source,
    button,
    watched: button
      ? [composer.source.element, button.element]
      : [composer.source.element],
  };
};
