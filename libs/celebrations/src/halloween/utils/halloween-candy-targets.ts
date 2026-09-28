import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';

/** Measured collision surfaces; no surface is copied or animated. */
export interface CandyTargets {
  width: number;
  height: number;
  rtl: boolean;
  surfaces: CelebrationSnapshotTarget[];
}

/** Bounded cached discovery, including hosts with only a focused composer. */
export const getCandyTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): CandyTargets => {
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const rects = new Map<Element, DOMRect>();
  const styles = new Map<Element, CSSStyleDeclaration>();
  const rect = (element: Element) => {
    if (!rects.has(element))
      rects.set(element, element.getBoundingClientRect());
    return rects.get(element)!;
  };
  const style = (element: Element) => {
    if (!styles.has(element)) styles.set(element, getComputedStyle(element));
    return styles.get(element)!;
  };
  const visible = (
    element: HTMLElement,
  ): CelebrationSnapshotTarget | undefined => {
    if (
      element.closest(
        '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]',
      )
    )
      return;
    const box = rect(element);
    if (
      box.width < 40 ||
      box.height < 20 ||
      box.left < 12 ||
      box.right > width - 12 ||
      box.top < 70 ||
      box.bottom > height - 40
    )
      return;
    let parent: Element | null = element;
    for (
      let depth = 0;
      parent && depth < 32;
      depth++, parent = parent.parentElement
    ) {
      const css = style(parent);
      if (
        css.display === 'none' ||
        /hidden|collapse/.test(css.visibility) ||
        css.contentVisibility === 'hidden' ||
        (css.opacity !== '' && Number(css.opacity) < 1) ||
        [
          css.transform,
          css.translate,
          css.rotate,
          css.scale,
          css.filter,
          css.clipPath,
          css.maskImage,
        ].some((value) => value && value !== 'none')
      )
        return;
      const clipsX = /auto|scroll|hidden|clip/.test(
        css.overflowX || css.overflow,
      );
      const clipsY = /auto|scroll|hidden|clip/.test(
        css.overflowY || css.overflow,
      );
      if (clipsX || clipsY) {
        const bounds = rect(parent);
        if (
          (clipsX && (box.left < bounds.left || box.right > bounds.right)) ||
          (clipsY && (box.top < bounds.top || box.bottom > bounds.bottom))
        )
          return;
      }
    }
    return parent ? undefined : { element, rect: box };
  };
  const surfaces: CelebrationSnapshotTarget[] = [];
  const composers = anchors.composer
    ? document.getElementsByClassName(anchors.composer)
    : [];
  let composer: HTMLElement | undefined;
  for (let i = 0; i < Math.min(4, composers.length); i++) {
    const element = composers[i];
    if (!(element instanceof HTMLElement)) continue;
    const target = visible(element);
    if (target) {
      composer = element;
      surfaces.push(target);
      break;
    }
  }
  const region = findWelcomeRegion(composer, anchors);
  const lists = anchors.starterList
    ? region?.getElementsByClassName(anchors.starterList)
    : undefined;
  let inspected = 0;
  for (let i = 0; i < Math.min(2, lists?.length ?? 0); i++) {
    const buttons = lists![i].getElementsByTagName('button');
    for (let j = 0; j < buttons.length && inspected < 12; j++, inspected++) {
      if (surfaces.length >= (isMobile ? 2 : 3)) break;
      const element = buttons[j];
      if (
        element.disabled ||
        element.getAttribute('aria-expanded') === 'true' ||
        element.getAttribute('aria-disabled') === 'true' ||
        element.contains(document.activeElement)
      )
        continue;
      const target = visible(element);
      if (target && !surfaces.some((other) => other.element.contains(element)))
        surfaces.push(target);
    }
  }
  return {
    width,
    height,
    surfaces,
    rtl: style(composer ?? document.documentElement).direction === 'rtl',
  };
};
