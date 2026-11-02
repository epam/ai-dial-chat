import type { CelebrationAnchors } from '../../models/celebration';
import { findWelcomeRegion } from '../../utils/host-anchors';
import { SnowmanStage } from '../types/new-year';
import { getGiftWrappingTarget } from './gift-wrapping-targets';
import {
  glideEndSpeed,
  HEAD_FLIGHT,
  SNOWMAN_RIG,
  SNOWMAN_SCALE,
} from './snowman-delivery-rig';

/** A live element and its bounds when the scene was prepared. */
export interface MeasuredElement {
  element: HTMLElement;
  rect: DOMRect;
}

/** A horizontal extent in viewport pixels. */
export interface Bounds {
  left: number;
  right: number;
}

/** Measured stage, staging mode and travel geometry of one activation, in viewport pixels. */
export interface SnowmanDeliveryTargets {
  width: number;
  height: number;
  rtl: boolean;
  mode: SnowmanStage;
  /** CSS pixels per native unit. */
  scale: number;
  /** Viewport x direction of the slide toward the tree. */
  dir: 1 | -1;
  /** Viewport y of the ground the snowman stands on. */
  floor: number;
  /** Viewport x of the edge he enters from and leaves through. */
  startEdge: number;
  /** Where he stands to pick the card up and to set the sled down. */
  stanceX: number;
  /** Sled (card copy or drawn sled) size and its centre when placed. */
  sled: { width: number; height: number; startX: number };
  /** Distance from the sled's front edge back to the seat. */
  seatFromFront: number;
  /** Sled travel from placement to the snowbank, including both pushes. */
  slideLength: number;
  /** Horizontal head flight from the neck at impact to the branch socket, and its duration. */
  headFlight: { distance: number; seconds: number };
  snowbankX: number;
  /** Lower-branch socket the head lodges in. */
  branchX: number;
  treeX: number;
  /** The borrowed starter card, or `null` for a drawn sled. */
  card: MeasuredElement | null;
  /** Horizontal extent of the welcome region; the scene is clipped to it. */
  bounds: Bounds;
  /** Host elements whose mutation or movement cancels the scene. */
  watched: HTMLElement[];
}

const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const MAX_CANDIDATES = 4;
const MAX_ANCESTORS = 24;
const MAX_CARD_NODES = 40;
const CARD_MIN = { width: 36, height: 24 };
const CARD_MAX = { width: 240, height: 96 };
const TRAVEL = {
  desktop: { min: 160, max: 460 },
  mobile: { min: 100, max: 220 },
};
const VIEWPORT_MARGIN = 16;

/* Native-unit spacing of the staged props. */
/** He stands this far before the card's near edge to grip its bottom edge. */
export const STANCE_TO_CARD = 14;
/** The sled lands this far ahead of the stance, clear of his belly. */
export const STANCE_TO_SLED = 36;
/** Lowest reachable card bottom above the floor, in native units. */
const MIN_GRIP_HEIGHT = 40;
/** Farthest he walks in from before the pickup stance, in native units. */
const MAX_ENTRY = 200;
/** Head room above a seated snowman on the sled, in native units. */
const SEATED_CLEARANCE = 130;
/** Tallest card a ledge pickup may jump for, in native units. */
const MAX_LEDGE_CARD_HEIGHT = 66;
/* The head socket sits this far before the trunk, see `BRANCH_SOCKET`. */
const BRANCH_TO_TREE = 26;
const TREE_HALF_WIDTH = 34;
const SNOWBANK_HALF_WIDTH = 15;
const GROUND_THICKNESS = 14;
/* The snow cap on the composer rim is thin and sits on its top border. */
const RIM_CAP_THICKNESS = 4;

const measured = (
  element: Element | null | undefined,
): MeasuredElement | null => {
  if (!(element instanceof HTMLElement) || !element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility !== 'visible') return null;
  return { element, rect };
};

const intersects = (
  rect: { left: number; right: number; top: number; bottom: number },
  band: { left: number; right: number; top: number; bottom: number },
) =>
  rect.left < band.right &&
  rect.right > band.left &&
  rect.top < band.bottom &&
  rect.bottom > band.top;

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
    const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
    const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
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

/** Whether an idle starter button can be copied as the sled. */
const isEligibleCard = (
  candidate: MeasuredElement,
  width: number,
  height: number,
): boolean => {
  const { element, rect } = candidate;
  const style = getComputedStyle(element);
  return !(
    element.matches(':disabled, [aria-disabled="true"]') ||
    element.contains(document.activeElement) ||
    matchesSafely(element, ':hover') ||
    matchesSafely(element, ':active') ||
    element.closest(EXCLUDED) ||
    (style.transform !== 'none' && style.transform !== '') ||
    typeof element.animate !== 'function' ||
    rect.width < CARD_MIN.width ||
    rect.width > CARD_MAX.width ||
    rect.height < CARD_MIN.height ||
    rect.height > CARD_MAX.height ||
    rect.left < 0 ||
    rect.right > width ||
    rect.top < 0 ||
    rect.bottom > height ||
    element.getElementsByTagName('*').length + 1 > MAX_CARD_NODES ||
    isClipped(element, rect)
  );
};

interface Layout {
  dir: 1 | -1;
  stanceX: number;
  sled: SnowmanDeliveryTargets['sled'];
  seatFromFront: number;
  slideLength: number;
  headFlight: SnowmanDeliveryTargets['headFlight'];
  snowbankX: number;
  branchX: number;
  treeX: number;
  startEdge: number;
}

/**
 * Lays the story out from `stanceX` toward `dir`: the sled is set down just
 * ahead, slides until its front meets the snowbank, and the tree stands so
 * that the head, launched at the sled's speed, lands in its lower branch.
 * Tries the longest ride first and shortens it until both the viewport and
 * `isClear` accept it; returns `null` when no ride fits.
 */
const layout = (
  stanceX: number,
  dir: 1 | -1,
  sledSize: [number, number],
  scale: number,
  bounds: Bounds,
  isMobile: boolean,
  isClear: (plan: Layout) => boolean = () => true,
): Layout | null => {
  const travel = isMobile ? TRAVEL.mobile : TRAVEL.desktop;
  const [sledWidth, sledHeight] = sledSize;
  /* He sits toward the front, so the head clears the front edge quickly. */
  const seatFromFront = Math.max(30 * scale, sledWidth * 0.25);
  const startX = stanceX + dir * (STANCE_TO_SLED * scale + sledWidth / 2);
  const seatX = startX + dir * (sledWidth / 2 - seatFromFront);
  /* The branch tip overhangs the snowbank, just past the sled's front. */
  const minimumFlight = seatFromFront + 4 * scale;
  const speedPerPixel = glideEndSpeed(1);
  /* A slide this long launches the head fast enough to clear the front. */
  const minimumLength = minimumFlight / (speedPerPixel * HEAD_FLIGHT.max);
  const tail = (BRANCH_TO_TREE + TREE_HALF_WIDTH) * scale;
  const available =
    dir > 0
      ? bounds.right - VIEWPORT_MARGIN - seatX
      : seatX - bounds.left - VIEWPORT_MARGIN;
  const rear = startX - (dir * sledWidth) / 2;
  if (
    rear < bounds.left + VIEWPORT_MARGIN / 2 ||
    rear > bounds.right - VIEWPORT_MARGIN / 2
  )
    return null;
  const flightFor = (length: number) =>
    Math.max(minimumFlight, speedPerPixel * length * HEAD_FLIGHT.nominal);
  const fits = (length: number) =>
    length + flightFor(length) + tail <= available;
  const planFor = (slideLength: number): Layout | null => {
    if (slideLength < minimumLength || !fits(slideLength)) return null;
    const speed = speedPerPixel * slideLength;
    const distance = flightFor(slideLength);
    const seconds = distance / speed;
    if (seconds < HEAD_FLIGHT.min || seconds > HEAD_FLIGHT.max) return null;
    const seatEnd = seatX + dir * slideLength;
    const front = seatEnd + dir * seatFromFront;
    const branchX = seatEnd + dir * distance;
    return {
      dir,
      stanceX,
      sled: { width: sledWidth, height: sledHeight, startX },
      seatFromFront,
      slideLength,
      headFlight: { distance, seconds },
      snowbankX: front + dir * SNOWBANK_HALF_WIDTH * 0.6 * scale,
      branchX,
      treeX: branchX + dir * BRANCH_TO_TREE * scale,
      startEdge:
        dir > 0
          ? Math.max(bounds.left, stanceX - MAX_ENTRY * scale)
          : Math.min(bounds.right, stanceX + MAX_ENTRY * scale),
    };
  };
  /* The longest ride that the viewport and the host content both allow. */
  for (let length = travel.max; length >= travel.min; length -= 8) {
    const plan = planFor(length);
    if (plan && isClear(plan)) return plan;
  }
  return null;
};

/** The band the cast occupies along its whole path, from the entrance edge to the tree. */
const castBand = (
  plan: Layout,
  floor: number,
  top: number,
  scale: number,
  below = GROUND_THICKNESS * scale,
) => ({
  left: Math.min(plan.startEdge, plan.treeX - TREE_HALF_WIDTH * scale),
  right: Math.max(plan.startEdge, plan.treeX + TREE_HALF_WIDTH * scale),
  top,
  bottom: floor + below,
});

/**
 * Measures the host once and picks the first staging mode that fits:
 * a ledge under the starter row, the composer rim with a borrowed card,
 * the rim with a drawn sled, a snowy platform, or the static still.
 */
export const getSnowmanDeliveryTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): SnowmanDeliveryTargets => {
  const stage = getGiftWrappingTarget(anchors, isMobile);
  const { width, height, rtl } = stage;
  const scale = isMobile ? SNOWMAN_SCALE.mobile : SNOWMAN_SCALE.desktop;
  const preferred: 1 | -1 = rtl ? -1 : 1;
  const directions: (1 | -1)[] = [preferred, -preferred as 1 | -1];
  const composer = stage.source;
  const region =
    findWelcomeRegion(composer?.element, anchors) ??
    document.querySelector(anchors.welcomeRegion ?? '[role="region"]');
  const regionRect = region?.getBoundingClientRect();
  const bounds: Bounds =
    regionRect && regionRect.width > 0
      ? {
          left: Math.max(0, regionRect.left),
          right: Math.min(width, regionRect.right),
        }
      : { left: 0, right: width };
  const heading = measured(
    region?.querySelector('h1, h2, [role="heading"]') ?? null,
  );
  const starters = measured(
    anchors.starterList
      ? region?.getElementsByClassName(anchors.starterList)[0]
      : null,
  );
  const watched = [composer, starters, heading]
    .filter((item) => item != null)
    .map(({ element }) => element);
  const hostRects = [composer, heading, starters]
    .filter((item) => item != null)
    .map(({ rect }) => rect);
  const candidates: MeasuredElement[] = [];
  if (starters) {
    const buttons = starters.element.getElementsByTagName('button');
    for (let i = 0; i < Math.min(buttons.length, MAX_CANDIDATES); i++) {
      const candidate = measured(buttons[i]);
      if (candidate && isEligibleCard(candidate, width, height))
        candidates.push(candidate);
    }
  }
  const startersBelow =
    !!starters && (!composer || starters.rect.top >= composer.rect.bottom - 1);
  const startersAbove =
    !!starters && !!composer && starters.rect.bottom <= composer.rect.top + 1;
  const result = (
    mode: SnowmanStage,
    floor: number,
    plan: Layout | null,
    card: MeasuredElement | null,
  ): SnowmanDeliveryTargets => ({
    width,
    height,
    rtl,
    mode,
    scale,
    dir: plan?.dir ?? preferred,
    floor,
    startEdge: plan?.startEdge ?? (preferred > 0 ? bounds.left : bounds.right),
    stanceX: plan?.stanceX ?? (bounds.left + bounds.right) / 2,
    sled: plan?.sled ?? { width: 0, height: 0, startX: width / 2 },
    seatFromFront: plan?.seatFromFront ?? 0,
    slideLength: plan?.slideLength ?? 0,
    headFlight: plan?.headFlight ?? { distance: 0, seconds: 0 },
    snowbankX: plan?.snowbankX ?? width / 2,
    branchX: plan?.branchX ?? width / 2,
    treeX: plan?.treeX ?? width / 2,
    card,
    bounds,
    watched: card ? [...watched, card.element] : watched,
  });
  const fitsBand = (
    plan: Layout,
    floor: number,
    top: number,
    ignore?: DOMRect,
    below = GROUND_THICKNESS * scale,
  ) =>
    floor + below + VIEWPORT_MARGIN <= height &&
    top >= 0 &&
    !hostRects.some(
      (rect) =>
        rect !== ignore &&
        intersects(rect, castBand(plan, floor, top, scale, below)),
    );
  const sledOf = (card: MeasuredElement | null): [number, number] =>
    card
      ? [card.rect.width, card.rect.height]
      : [SNOWMAN_RIG.sledSize[0] * scale, SNOWMAN_RIG.sledSize[1] * scale];
  /* Nearest to the entrance side first. */
  const ordered = [...candidates].sort((a, b) =>
    preferred > 0 ? a.rect.left - b.rect.left : b.rect.right - a.rect.right,
  );

  if (startersBelow && starters) {
    const bottomRow = ordered.filter(
      ({ rect }) => Math.abs(rect.bottom - starters.rect.bottom) <= 2,
    );
    for (const card of bottomRow) {
      if (card.rect.height / scale > MAX_LEDGE_CARD_HEIGHT) continue;
      /* Seated on the copy, his head still clears the starter row. */
      const floor =
        card.rect.bottom + card.rect.height + SEATED_CLEARANCE * scale;
      for (const dir of directions) {
        const plan = layout(
          (dir > 0 ? card.rect.left : card.rect.right) -
            dir * STANCE_TO_CARD * scale,
          dir,
          sledOf(card),
          scale,
          bounds,
          isMobile,
          /* The band starts under the row: only the raised mittens reach into it. */
          (candidate) =>
            fitsBand(candidate, floor, card.rect.bottom, starters.rect),
        );
        if (plan) return result(SnowmanStage.Ledge, floor, plan, card);
      }
    }
  }

  if (composer) {
    const cap = RIM_CAP_THICKNESS * scale;
    const floor = composer.rect.top - cap;
    const castTop = (sled: [number, number]) =>
      floor -
      Math.max(
        SNOWMAN_RIG.castHeight * scale,
        sled[1] + SEATED_CLEARANCE * scale,
      );
    const top = castTop(sledOf(null));
    if (startersAbove && starters) {
      const nextRow = ordered.filter(
        ({ rect }) =>
          Math.abs(rect.bottom - starters.rect.bottom) <= 2 &&
          rect.bottom >= floor - SNOWMAN_RIG.reach * scale &&
          rect.bottom <= floor - MIN_GRIP_HEIGHT * scale,
      );
      for (const card of nextRow) {
        const cardTop = castTop(sledOf(card));
        for (const dir of directions) {
          /* Only the borrowed card may share the band with the cast; a
             longer list than the bounded scan counts as crowded. */
          const buttons = starters.element.getElementsByTagName('button');
          const isRimClear = (candidate: Layout) => {
            const band = castBand(candidate, floor, cardTop, scale, cap);
            return (
              buttons.length <= MAX_CANDIDATES &&
              !Array.from(buttons).some(
                (button) =>
                  button !== card.element &&
                  intersects(button.getBoundingClientRect(), band),
              ) &&
              fitsBand(candidate, floor, cardTop, starters.rect, cap) &&
              !(heading && intersects(heading.rect, band))
            );
          };
          const plan = layout(
            (dir > 0 ? card.rect.left : card.rect.right) -
              dir * STANCE_TO_CARD * scale,
            dir,
            sledOf(card),
            scale,
            bounds,
            isMobile,
            isRimClear,
          );
          if (plan) return result(SnowmanStage.Rim, floor, plan, card);
        }
      }
    }
    for (const dir of directions) {
      const stanceX =
        dir > 0
          ? composer.rect.left + 40 * scale
          : composer.rect.right - 40 * scale;
      const plan = layout(
        stanceX,
        dir,
        sledOf(null),
        scale,
        bounds,
        isMobile,
        (candidate) => fitsBand(candidate, floor, top, undefined, cap),
      );
      if (plan) return result(SnowmanStage.RimSled, floor, plan, null);
    }
  }

  const lowest = Math.max(0, ...hostRects.map((rect) => rect.bottom));
  const floor = lowest + SNOWMAN_RIG.castHeight * scale + 12;
  const actionWidth = Math.min(
    isMobile ? 250 : 340,
    bounds.right - bounds.left - 32,
  );
  const middle = (bounds.left + bounds.right) / 2;
  for (const dir of directions) {
    const stanceX = middle - (dir * actionWidth) / 2 + dir * 40 * scale;
    const plan = layout(
      stanceX,
      dir,
      sledOf(null),
      scale,
      bounds,
      isMobile,
      (candidate) => fitsBand(candidate, floor, lowest),
    );
    if (plan) return result(SnowmanStage.Platform, floor, plan, null);
  }

  return result(SnowmanStage.Static, height, null, null);
};
