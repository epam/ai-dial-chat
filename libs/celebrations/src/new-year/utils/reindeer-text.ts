import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';

/** A measured word, never an editable clone or a mutation of the draft. */
export interface ReindeerText {
  element: HTMLTextAreaElement;
  rect: DOMRect;
  text: string;
  style: Partial<CSSStyleDeclaration>;
  background: string;
}

const FONT_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontStretch',
  'fontVariant',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'direction',
  'textAlign',
  'textIndent',
  'lineHeight',
] as const;

/** Measure a short visible word with a disposable native-layout mirror. */
export const getReindeerText = (
  composer: CelebrationSnapshotTarget,
): ReindeerText | null => {
  const inputs = composer.element.getElementsByTagName('textarea');
  for (let i = 0; i < Math.min(4, inputs.length); i++) {
    const element = inputs[i];
    const rect = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    const isPlaceholder = !element.value;
    const text = (isPlaceholder ? element.placeholder : element.value).slice(
      0,
      512,
    );
    const match = /\S{1,32}/u.exec(text);
    if (
      !match ||
      element.disabled ||
      element.scrollTop ||
      element.scrollLeft ||
      element.closest('[hidden], [inert], [aria-hidden="true"]') ||
      css.visibility !== 'visible' ||
      css.display === 'none' ||
      css.opacity === '0' ||
      (css.transform && css.transform !== 'none') ||
      rect.width < 30 ||
      rect.height < 12 ||
      rect.left < composer.rect.left ||
      rect.right > composer.rect.right ||
      rect.top < composer.rect.top ||
      rect.bottom > composer.rect.bottom
    )
      continue;
    const ink = isPlaceholder
      ? getComputedStyle(element, '::placeholder')
      : css;
    if (ink.color === 'transparent' || ink.color === 'rgba(0, 0, 0, 0)')
      continue;
    let background = '';
    let parent: HTMLElement | null = element;
    for (
      let depth = 0;
      parent && depth < 24;
      depth++, parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      /* A rectangular word cutout is only sound on a flat opaque surface. */
      if (style.backgroundImage && style.backgroundImage !== 'none') break;
      if (/^rgb\(/.test(style.backgroundColor)) {
        background = style.backgroundColor;
        break;
      }
    }
    if (!background) continue;
    const mirror = document.createElement('div');
    const word = document.createElement('span');
    const font: Partial<CSSStyleDeclaration> = {};
    for (const name of FONT_PROPERTIES) font[name] = css[name];
    Object.assign(mirror.style, font, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      boxSizing: 'border-box',
      padding: css.padding,
      border: css.border,
      margin: '0',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      visibility: 'hidden',
      pointerEvents: 'none',
    });
    mirror.inert = true;
    mirror.setAttribute('aria-hidden', 'true');
    word.textContent = match[0];
    mirror.append(
      document.createTextNode(text.slice(0, match.index)),
      word,
      document.createTextNode(text.slice(match.index + match[0].length)),
    );
    document.body.append(mirror);
    try {
      const box = word.getBoundingClientRect();
      if (
        word.getClientRects().length !== 1 ||
        box.width < 4 ||
        box.width > 280 ||
        box.height < 8 ||
        box.height > 48 ||
        box.left < rect.left ||
        box.right > rect.right ||
        box.top < rect.top ||
        box.bottom > rect.bottom
      )
        continue;
      return {
        element,
        rect: box,
        text: match[0],
        background,
        style: {
          ...font,
          lineHeight: `${box.height}px`,
          textIndent: '0',
          color: ink.color,
          opacity: ink.opacity || '1',
          whiteSpace: 'pre',
        },
      };
    } finally {
      mirror.remove();
    }
  }
  return null;
};

/** Cover only the word's original pixels; the real textarea stays untouched. */
export const animateReindeerText = (
  word: ReindeerText,
  host: HTMLElement,
  frames: Keyframe[],
  duration: number,
  startTime: number,
  caught: number,
  restored: number,
): (() => void) => {
  const mask = document.createElement('div');
  const copy = document.createElement('span');
  const { rect } = word;
  for (const element of [mask, copy]) {
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    Object.assign(element.style, {
      position: 'absolute',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: 'none',
    });
  }
  Object.assign(mask.style, { backgroundColor: word.background });
  Object.assign(copy.style, word.style, { transformOrigin: 'center' });
  copy.textContent = word.text;
  copy.dataset.reindeerWord = 'true';
  mask.dataset.reindeerWordMask = 'true';
  host.append(mask, copy);
  const animations: Animation[] = [];
  const stop = () => {
    animations.forEach((animation) => animation.cancel());
    mask.remove();
    copy.remove();
  };
  try {
    animations.push(copy.animate(frames, { duration, fill: 'both' }));
    /* Both disappear only when the word has returned exactly to its origin. */
    for (const element of [mask, copy])
      animations.push(
        element.animate(
          [
            { offset: 0, opacity: 0, easing: 'steps(1, end)' },
            { offset: caught, opacity: 1, easing: 'steps(1, end)' },
            { offset: restored, opacity: 0 },
            { offset: 1, opacity: 0 },
          ],
          { duration, fill: 'both' },
        ),
      );
    animations.forEach((animation) => {
      animation.startTime = startTime;
    });
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
};
