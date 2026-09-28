import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';

/** Maximum composer candidates measured during one preparation. */
export const SKELETON_COMPOSER_LIMIT = 4;
/** Maximum ancestors inspected for each candidate. */
export const SKELETON_ANCESTOR_LIMIT = 32;

/** A measured input edge; it is never copied, hidden or animated. */
export interface SkeletonComposer extends CelebrationSnapshotTarget {
  borderRadius?: string;
}

/** Measured viewport and the optional stage for the dancing pair. */
export interface SkeletonTargets {
  width: number;
  height: number;
  rtl: boolean;
  composer?: SkeletonComposer;
}

const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';

/** Bounded cached discovery; a focused composer with a draft is only measured. */
export const getSkeletonTargets = (
  anchors: CelebrationAnchors,
): SkeletonTargets => {
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const rects = new Map<Element, DOMRect>();
  const styles = new Map<Element, CSSStyleDeclaration>();
  const rect = (element: Element) => {
    const cached = rects.get(element) ?? element.getBoundingClientRect();
    rects.set(element, cached);
    return cached;
  };
  const style = (element: Element) => {
    const cached = styles.get(element) ?? getComputedStyle(element);
    styles.set(element, cached);
    return cached;
  };
  const visible = (element: HTMLElement): SkeletonComposer | undefined => {
    if (element.closest(EXCLUDED)) return;
    const box = rect(element);
    if (
      box.width < 120 ||
      box.height < 24 ||
      box.left < 0 ||
      box.right > width ||
      box.top < 0 ||
      box.bottom > height
    )
      return;
    let parent: Element | null = element;
    for (
      let depth = 0;
      parent && depth < SKELETON_ANCESTOR_LIMIT;
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
      if (parent !== element && (clipsX || clipsY)) {
        const bounds = rect(parent);
        if (
          (clipsX && (box.left < bounds.left || box.right > bounds.right)) ||
          (clipsY && (box.top < bounds.top || box.bottom > bounds.bottom))
        )
          return;
      }
    }
    return parent
      ? undefined
      : { element, rect: box, borderRadius: style(element).borderRadius };
  };
  let composer: SkeletonComposer | undefined;
  const candidates = anchors.composer
    ? document.getElementsByClassName(anchors.composer)
    : [];
  for (
    let i = 0;
    i < Math.min(SKELETON_COMPOSER_LIMIT, candidates.length) && !composer;
    i++
  ) {
    const element = candidates[i];
    if (element instanceof HTMLElement) composer = visible(element);
  }
  return {
    width,
    height,
    composer,
    rtl:
      style(composer?.element ?? document.documentElement).direction === 'rtl',
  };
};
