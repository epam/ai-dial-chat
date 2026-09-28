import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';

/** Maximum candidate starter buttons inspected during one preparation. */
export const FOOTPRINT_SCAN_LIMIT = 12;
/** Maximum descendants in the single borrowed card. */
export const FOOTPRINT_COPY_NODE_LIMIT = 40;
/* Leave room for the copy's icon inside the mobile scene's 80-node SVG budget. */
const COPY_SVG_LIMIT = 12;

/** A measured input outline, without copying any editable descendants. */
export interface FootprintComposer extends CelebrationSnapshotTarget {
  borderRadius?: string;
}

/** Measured viewport and optional safe props for the invisible familiar. */
export interface FootprintTargets {
  width: number;
  height: number;
  /** Measured landing ledge; never copied or moved. */
  composer?: FootprintComposer;
  /** One eligible starter button, never a composer control. */
  card?: CelebrationSnapshotTarget;
}

const UNSAFE =
  ':disabled, [aria-disabled="true"], [aria-expanded="true"], input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';

/** Select one visible idle starter through host anchors with bounded cached reads. */
export const getFootprintTargets = (
  anchors: CelebrationAnchors,
): FootprintTargets => {
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const result: FootprintTargets = { width, height };
  const rects = new Map<HTMLElement, DOMRect>();
  const styles = new Map<HTMLElement, CSSStyleDeclaration>();
  const measure = (element: HTMLElement) => {
    let rect = rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      rects.set(element, rect);
    }
    return rect;
  };
  const visible = (element: HTMLElement) => {
    if (element.closest(EXCLUDED)) return;
    const rect = measure(element);
    if (
      rect.width < 20 ||
      rect.height < 20 ||
      rect.left < 12 ||
      rect.right > width - 12 ||
      rect.top < 12 ||
      rect.bottom > height - 16
    )
      return;
    let parent: HTMLElement | null = element;
    for (
      let depth = 0;
      parent && depth < 32;
      depth++, parent = parent.parentElement
    ) {
      let style = styles.get(parent);
      if (!style) {
        style = getComputedStyle(parent);
        styles.set(parent, style);
      }
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.contentVisibility === 'hidden' ||
        [style.clipPath, style.maskImage, style.filter].some(
          (value) => value && value !== 'none',
        ) ||
        (style.opacity !== '' && Number(style.opacity) < 1) ||
        (style.transform && style.transform !== 'none') ||
        [style.rotate, style.scale, style.translate].some(
          (value) => value && value !== 'none',
        )
      )
        return;
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(
        style.overflowX || style.overflow,
      );
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(
        style.overflowY || style.overflow,
      );
      if (clipsX || clipsY) {
        const clip = measure(parent);
        if (
          (clipsX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipsY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return;
      }
    }
    return parent ? undefined : { element, rect };
  };
  if (!anchors.composer) return result;
  const composers = document.getElementsByClassName(anchors.composer);
  for (let i = 0; i < Math.min(4, composers.length); i++) {
    const element = composers[i];
    if (element instanceof HTMLElement) result.composer = visible(element);
    if (result.composer) {
      result.composer.borderRadius = styles.get(
        result.composer.element,
      )?.borderRadius;
      break;
    }
  }
  if (!result.composer || !anchors.starterList) return result;
  const region = findWelcomeRegion(result.composer.element, anchors);
  const lists = region?.getElementsByClassName(anchors.starterList);
  let inspected = 0;
  const candidates: CelebrationSnapshotTarget[] = [];
  for (let i = 0; i < Math.min(2, lists?.length ?? 0); i++) {
    const buttons = lists![i].getElementsByTagName('button');
    for (
      let j = 0;
      j < buttons.length && inspected < FOOTPRINT_SCAN_LIMIT;
      j++, inspected++
    ) {
      const element = buttons[j];
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_ELEMENT,
      );
      let descendants = 0;
      let svgNodes = 0;
      while (descendants <= FOOTPRINT_COPY_NODE_LIMIT && walker.nextNode()) {
        descendants++;
        if (walker.currentNode instanceof SVGElement) svgNodes++;
      }
      if (
        descendants > FOOTPRINT_COPY_NODE_LIMIT ||
        svgNodes > COPY_SVG_LIMIT ||
        element.contains(document.activeElement) ||
        element.closest(UNSAFE) ||
        element.querySelector(UNSAFE)
      )
        continue;
      const candidate = visible(element);
      if (
        candidate &&
        candidate.rect.width >= 72 &&
        candidate.rect.width <= 240 &&
        candidate.rect.height >= 32 &&
        candidate.rect.height <= 96 &&
        candidate.rect.top >= 120 &&
        (candidate.rect.left + candidate.rect.width / 2 >= width / 2
          ? candidate.rect.left >= 112
          : candidate.rect.right <= width - 112) &&
        (candidate.rect.bottom + 8 < result.composer.rect.top ||
          candidate.rect.top > result.composer.rect.bottom + 8)
      )
        candidates.push(candidate);
    }
  }
  const composer = result.composer.rect;
  const distance = ({ rect }: CelebrationSnapshotTarget) =>
    Math.hypot(
      rect.left + rect.width / 2 - composer.left - composer.width / 2,
      Math.max(composer.top - rect.bottom, rect.top - composer.bottom, 0),
    );
  candidates.sort((a, b) => distance(a) - distance(b));
  result.card = candidates[0];
  return result;
};
