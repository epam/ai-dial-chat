import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';

/** Maximum composer candidates measured during one preparation. */
export const SKELETON_COMPOSER_LIMIT = 4;
/** Maximum ancestors inspected for each candidate. */
export const SKELETON_ANCESTOR_LIMIT = 32;
/** Maximum text nodes visited in the greeting heading. */
export const SKELETON_TEXT_NODE_LIMIT = 16;

/** A measured input edge; it is never copied, hidden or animated. */
export interface SkeletonComposer extends CelebrationSnapshotTarget {
  borderRadius?: string;
}

/** Computed text presentation copied onto the decorative word. */
export interface SkeletonWordFont {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  color: string;
  textTransform: string;
}

/** The last word of the greeting heading; hidden only through a highlight. */
export interface SkeletonGreetingWord {
  heading: HTMLElement;
  headingRect: DOMRect;
  range: Range;
  rect: DOMRect;
  text: string;
  font: SkeletonWordFont;
}

/** Measured viewport and the optional stage for the dancing pair. */
export interface SkeletonTargets {
  width: number;
  height: number;
  rtl: boolean;
  composer?: SkeletonComposer;
  word?: SkeletonGreetingWord;
}

/** Highlight name whose stylesheet rule hides the borrowed word's glyphs. */
export const SKELETON_WORD_HIGHLIGHT = 'celebration-skeleton-word';

const LAST_WORD = /([^\s\p{P}]+)[\s\p{P}]*$/u;

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
  const visible = (
    element: HTMLElement,
    minWidth = 120,
    minHeight = 24,
  ): SkeletonComposer | undefined => {
    if (element.closest(EXCLUDED)) return;
    const box = rect(element);
    if (
      box.width < minWidth ||
      box.height < minHeight ||
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
  /* The heading text is only measured; the library never knows whose name it is. */
  const findWord = (): SkeletonGreetingWord | undefined => {
    if (
      typeof CSS === 'undefined' ||
      !('highlights' in CSS) ||
      typeof Highlight !== 'function'
    )
      return;
    const heading = findWelcomeRegion(
      composer?.element,
      anchors,
    )?.querySelector<HTMLElement>('h1, h2');
    const measured = heading && visible(heading, 16, 12);
    if (!heading || !measured) return;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (nodes.length < SKELETON_TEXT_NODE_LIMIT && walker.nextNode())
      nodes.push(walker.currentNode as Text);
    /* Trailing punctuation may sit in its own node ("<b>Valery</b>!"). */
    let last: Text | undefined;
    let match: RegExpExecArray | null = null;
    for (let i = nodes.length - 1; i >= 0 && !match; i--) {
      last = nodes[i];
      match = LAST_WORD.exec(last.data);
    }
    if (!last || !match) return;
    const range = document.createRange();
    range.setStart(last, match.index);
    range.setEnd(last, match.index + match[1].length);
    const box = range.getBoundingClientRect();
    if (
      box.width < 4 ||
      box.width > 320 ||
      box.height < 8 ||
      box.left < 0 ||
      box.right > width ||
      box.top < 0 ||
      box.bottom > height
    )
      return;
    const css = style(heading);
    return {
      heading,
      headingRect: measured.rect,
      range,
      rect: box,
      text: match[1],
      font: {
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        fontStyle: css.fontStyle,
        letterSpacing: css.letterSpacing,
        color: css.color,
        textTransform: css.textTransform,
      },
    };
  };
  return {
    width,
    height,
    composer,
    word: composer ? findWord() : undefined,
    rtl:
      style(composer?.element ?? document.documentElement).direction === 'rtl',
  };
};
