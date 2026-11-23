import {
  COPY_TRACK_STAGE_RULES as RULES,
  COPY_TRACK_STARTER_CARD as CARD,
} from '../constants/copy-track';
import type { CelebrationAnchors } from '../models/celebration';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import type { CopyTrackSection } from '../models/copy-track';
import type {
  CopyTrackMeasuredElement,
  CopyTrackSpanReferences,
  CopyTrackStageHost,
  CopyTrackStagePlan,
} from '../models/copy-track-stage';
import type { Point } from '../models/lottie-composition';
import {
  CopyTrackAnchor,
  CopyTrackRole,
  CopyTrackStage,
} from '../types/copy-track';
import { DEFAULT_WELCOME_REGION, findWelcomeRegion } from './host-anchors';

const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const MAX_ANCESTORS = 24;

type Band = CopyTrackStagePlan['band'];

const intersects = (rect: Band | DOMRect, band: Band) =>
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

const measured = (
  element: Element | null | undefined,
): CopyTrackMeasuredElement | null => {
  if (!(element instanceof HTMLElement) || !element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility !== 'visible') return null;
  return { element, rect };
};

/* Whether an idle starter button can be copied as the `starter-card`, given the reference card size in pixels. */
const isEligibleStarterCard = (
  { element, rect }: CopyTrackMeasuredElement,
  viewport: { width: number; height: number },
  reference: { width: number; height: number },
): boolean => {
  const style = getComputedStyle(element);
  return !(
    element.matches(':disabled, [aria-disabled="true"]') ||
    element.contains(document.activeElement) ||
    matchesSafely(element, ':hover') ||
    matchesSafely(element, ':active') ||
    element.closest(EXCLUDED) ||
    (!!style.transform && style.transform !== 'none') ||
    typeof element.animate !== 'function' ||
    rect.width < CARD.minWidth ||
    rect.width > CARD.maxWidth ||
    rect.height < CARD.minHeight ||
    rect.height > CARD.maxHeight ||
    rect.width < reference.width * CARD.widthBand.min ||
    rect.width > reference.width * CARD.widthBand.max ||
    rect.height < reference.height * CARD.heightBand.min ||
    rect.height > reference.height * CARD.heightBand.max ||
    rect.left < 0 ||
    rect.right > viewport.width ||
    rect.top < 0 ||
    rect.bottom > viewport.height ||
    element.getElementsByTagName('*').length + 1 > CARD.maxNodes ||
    isClipped(element, rect)
  );
};

/** Returns the host geometry the stages are solved against, read once from the host-supplied anchors. */
export const measureCopyTrackHost = (
  anchors: CelebrationAnchors,
  {
    composer,
    isMobile,
    direction,
    referenceCard,
    word,
  }: {
    /** The eligible composer from the anchor mapping, if any. */
    composer?: CopyTrackMeasuredElement;
    /** Whether the host uses its mobile layout. */
    isMobile: boolean;
    /** The host's writing direction; the story travels toward the inline end first. */
    direction: CelebrationTextDirection;
    /** Size of the authored reference card, in pixels. */
    referenceCard: { width: number; height: number };
    /** Bounds of the resolved composer word, if any. */
    word?: DOMRect;
  },
): CopyTrackStageHost & { watched: HTMLElement[] } => {
  const { clientWidth, clientHeight } = document.documentElement;
  const width = Math.max(1, clientWidth);
  const height = Math.max(1, clientHeight);
  const preferredSide: 1 | -1 = direction === 'rtl' ? -1 : 1;
  const region =
    findWelcomeRegion(composer?.element, anchors) ??
    document.querySelector(anchors.welcomeRegion ?? DEFAULT_WELCOME_REGION);
  const regionRect = region?.getBoundingClientRect();
  const bounds =
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
  const buttons = starters
    ? Array.from(starters.element.getElementsByTagName('button'))
    : [];
  const cards = buttons
    .slice(0, CARD.maxCandidates)
    .map((button) => measured(button))
    .filter(
      (candidate): candidate is CopyTrackMeasuredElement =>
        candidate !== null &&
        isEligibleStarterCard(candidate, { width, height }, referenceCard),
    )
    .sort((a, b) =>
      preferredSide > 0
        ? a.rect.left - b.rect.left
        : b.rect.right - a.rect.right,
    );
  return {
    width,
    height,
    bounds,
    preferredSide,
    isMobile,
    composer: composer?.rect,
    heading: heading?.rect,
    starters: starters
      ? {
          rect: starters.rect,
          buttons: buttons.map((element) => ({
            element,
            rect: element.getBoundingClientRect(),
          })),
        }
      : undefined,
    cards,
    word,
    watched: [composer, starters, heading]
      .filter((item): item is CopyTrackMeasuredElement => item != null)
      .map(({ element }) => element),
  };
};

const lerp = (from: number, to: number, weight: number) =>
  from + (to - from) * weight;

interface StageCandidate {
  stage: CopyTrackStage;
  floor: number;
  stanceX: number;
  side: 1 | -1;
  /** Band top for a given layout. */
  top: number;
  /** Band depth below the floor, in pixels. */
  below: number;
  /** Host rect the band may overlap. */
  ignore?: DOMRect;
  /** Extra clearance check on the band. */
  isClear?: (band: Band) => boolean;
  copy?: Point;
  card?: CopyTrackMeasuredElement;
}

/* Lays one candidate out at the longest span that fits; `null` when none does. */
const layOut = (
  candidate: StageCandidate,
  host: CopyTrackStageHost,
  references: CopyTrackSpanReferences,
  scale: number,
): CopyTrackStagePlan | null => {
  const { side, stanceX, floor } = candidate;
  const { stretchable } = references;
  const spanOf = (bound: 'min' | 'max') =>
    (stretchable[CopyTrackAnchor.SpanEnd][bound].x -
      stretchable[CopyTrackAnchor.SpanStart][bound].x) *
    scale;
  const minSpan = spanOf('min');
  const maxSpan = spanOf('max');
  if (!(maxSpan > minSpan) || !(minSpan > 0)) return null;
  const entryX =
    side > 0
      ? Math.max(host.bounds.left, stanceX - references.entry * scale)
      : Math.min(host.bounds.right, stanceX + references.entry * scale);
  const hostRects = [host.composer, host.heading, host.starters?.rect].filter(
    (rect): rect is DOMRect => rect !== undefined,
  );
  /* From the maximum down in steps, and the minimum itself last, so a page with room only for the minimum still fits. */
  const spans: number[] = [];
  for (let span = maxSpan; span > minSpan + 1e-9; span -= RULES.spanStepPx)
    spans.push(span);
  spans.push(minSpan);
  for (const span of spans) {
    const weight = (span - minSpan) / (maxSpan - minSpan);
    const place = (anchor: keyof CopyTrackSpanReferences['stretchable']) => {
      const { min, max } = stretchable[anchor];
      return {
        x: stanceX + side * lerp(min.x, max.x, weight) * scale,
        y: floor + lerp(min.y, max.y, weight) * scale,
      };
    };
    const far = place(CopyTrackAnchor.Far);
    const reach = far.x + side * references.overhang * scale;
    const band: Band = {
      left: Math.min(entryX, reach),
      right: Math.max(entryX, reach),
      top: candidate.top,
      bottom: floor + candidate.below,
    };
    const isInside =
      side > 0
        ? reach <= host.bounds.right - RULES.viewportMarginPx
        : reach >= host.bounds.left + RULES.viewportMarginPx;
    if (
      !isInside ||
      band.bottom + RULES.viewportMarginPx > host.height ||
      band.top < 0 ||
      hostRects.some(
        (rect) => rect !== candidate.ignore && intersects(rect, band),
      ) ||
      (candidate.isClear && !candidate.isClear(band))
    )
      continue;
    return {
      stage: candidate.stage,
      side,
      floor,
      span,
      card: candidate.card,
      band,
      anchors: {
        [CopyTrackAnchor.EntryEdge]: { x: entryX, y: floor },
        [CopyTrackAnchor.ExitEdge]: { x: entryX, y: floor },
        [CopyTrackAnchor.Stance]: { x: stanceX, y: floor },
        [CopyTrackAnchor.SpanStart]: place(CopyTrackAnchor.SpanStart),
        [CopyTrackAnchor.SpanEnd]: place(CopyTrackAnchor.SpanEnd),
        [CopyTrackAnchor.Far]: far,
        ...(candidate.copy && { [CopyTrackAnchor.Copy]: candidate.copy }),
      },
    };
  }
  return null;
};

const nearEdge = (rect: DOMRect, side: 1 | -1) =>
  side > 0 ? rect.left : rect.right;

/* Stage candidates for one section, in the order the compiled scene tries them. */
const candidatesFor = (
  { stage, role }: CopyTrackSection,
  host: CopyTrackStageHost,
  references: CopyTrackSpanReferences,
  scale: number,
): StageCandidate[] => {
  const sides: (1 | -1)[] = [host.preferredSide, -host.preferredSide as 1 | -1];
  const { composer, starters } = host;
  const groundBelow = RULES.groundBelow * scale;
  const cap = RULES.rimCap * scale;
  const onRow = (rect: DOMRect) =>
    starters !== undefined &&
    Math.abs(rect.bottom - starters.rect.bottom) <= RULES.rowTolerancePx;
  const fromCopy = (rect: DOMRect, side: 1 | -1) =>
    nearEdge(rect, side) - side * RULES.stanceToCopy * scale;
  const copyPoint = (rect: DOMRect, side: 1 | -1) => ({
    x: nearEdge(rect, side),
    y: rect.bottom,
  });

  if (stage === CopyTrackStage.Ledge) {
    if (role !== CopyTrackRole.StarterCard || !starters) return [];
    if (composer && starters.rect.top < composer.bottom - 1) return [];
    return host.cards
      .filter(
        ({ rect }) =>
          onRow(rect) && rect.height / scale <= RULES.maxLedgeCopyHeight,
      )
      .flatMap((card) => {
        const floor =
          card.rect.bottom + card.rect.height + RULES.seatedClearance * scale;
        return sides.map((side) => ({
          stage,
          floor,
          side,
          stanceX: fromCopy(card.rect, side),
          top: card.rect.bottom,
          below: groundBelow,
          ignore: starters.rect,
          copy: copyPoint(card.rect, side),
          card,
        }));
      });
  }

  if (stage === CopyTrackStage.Rim) {
    if (!composer) return [];
    const floor = composer.top - cap;
    const castTop = (height: number) =>
      floor -
      Math.max(
        RULES.castHeight * scale,
        height + RULES.seatedClearance * scale,
      );
    if (role === CopyTrackRole.StarterCard) {
      if (!starters || starters.rect.bottom > composer.top + 1) return [];
      return host.cards
        .filter(
          ({ rect }) =>
            onRow(rect) &&
            rect.bottom >= floor - RULES.maxReach * scale &&
            rect.bottom <= floor - RULES.minGrip * scale,
        )
        .flatMap((card) =>
          sides.map((side) => ({
            stage,
            floor,
            side,
            stanceX: fromCopy(card.rect, side),
            top: castTop(card.rect.height),
            below: cap,
            ignore: starters.rect,
            copy: copyPoint(card.rect, side),
            card,
            /* Only the borrowed card may share the band; a longer list than the scan counts as crowded. */
            isClear: (band: Band) =>
              starters.buttons.length <= CARD.maxCandidates &&
              !starters.buttons.some(
                (button) =>
                  button.element !== card.element &&
                  intersects(button.rect, band),
              ) &&
              !(host.heading && intersects(host.heading, band)),
          })),
        );
    }
    if (role === CopyTrackRole.ComposerWord) {
      const { word } = host;
      if (!word) return [];
      return sides.map((side) => ({
        stage,
        floor,
        side,
        stanceX: fromCopy(word, side),
        top: castTop(0),
        below: cap,
        copy: copyPoint(word, side),
      }));
    }
    return sides.map((side) => ({
      stage,
      floor,
      side,
      stanceX:
        side > 0
          ? composer.left + RULES.stanceInset * scale
          : composer.right - RULES.stanceInset * scale,
      top: castTop(0),
      below: cap,
    }));
  }

  if (role !== undefined) return [];
  const hostBottoms = [composer, host.heading, starters?.rect]
    .filter((rect): rect is DOMRect => rect !== undefined)
    .map((rect) => rect.bottom);
  const lowest = Math.max(0, ...hostBottoms);
  const floor = lowest + RULES.castHeight * scale + RULES.platformGapPx;
  const actionWidth = Math.min(
    host.isMobile
      ? RULES.platformActionWidthPx.mobile
      : RULES.platformActionWidthPx.desktop,
    host.bounds.right - host.bounds.left - 32,
  );
  const middle = (host.bounds.left + host.bounds.right) / 2;
  return sides.map((side) => ({
    stage,
    floor,
    side,
    stanceX:
      middle - (side * actionWidth) / 2 + side * RULES.stanceInset * scale,
    top: lowest,
    below: groundBelow,
  }));
};

/** Returns the first section, in priority order, whose stage qualifies and whose span fits against its own references, with its plan; `null` when none does. */
export const chooseCopyTrackSection = (
  sections: readonly CopyTrackSection[],
  host: CopyTrackStageHost,
  referencesOf: (section: CopyTrackSection) => CopyTrackSpanReferences,
  scale: number,
): { section: CopyTrackSection; plan: CopyTrackStagePlan } | null => {
  for (const section of sections) {
    const references = referencesOf(section);
    for (const candidate of candidatesFor(section, host, references, scale)) {
      const plan = layOut(candidate, host, references, scale);
      if (plan) return { section, plan };
    }
  }
  return null;
};
