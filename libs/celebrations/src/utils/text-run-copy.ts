import type {
  TextRun,
  TextRunCopyOptions,
  TextRunCopySession,
} from '../models/text-run-copy';
import type { CelebrationSnapshotTarget } from './celebration-snapshots';
import { makeTravelLayer } from './copy-layers';

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

/** Returns the first short visible run of a composer textarea's value or placeholder, measured with a disposable mirror, or `null`. */
export const findTextRun = (
  composer: CelebrationSnapshotTarget,
): TextRun | null => {
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

/**
 * Prepares a decorative copy of `run` and a cover over its original pixels.
 * The real textarea is never animated, styled or mutated.
 */
export const prepareTextRunCopy = (
  run: TextRun,
  {
    durationMs,
    showAt,
    hideAt,
    frames,
    travelFrames,
    decorate,
  }: TextRunCopyOptions,
): TextRunCopySession => {
  const cover = document.createElement('div');
  const copy = document.createElement('span');
  const travel = travelFrames ? makeTravelLayer() : undefined;
  const { rect } = run;
  for (const element of [cover, copy]) {
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
  Object.assign(cover.style, { backgroundColor: run.background });
  Object.assign(copy.style, run.style, { transformOrigin: 'center' });
  copy.textContent = run.text;
  decorate?.(copy, cover);
  const animations: Animation[] = [];
  let isAttached = false;
  let isStarted = false;
  let isStopped = false;
  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    animations.splice(0).forEach((animation) => animation.cancel());
    cover.remove();
    copy.remove();
    travel?.remove();
  };
  const attach = (host: HTMLElement) => {
    if (isStopped || isAttached) return;
    isAttached = true;
    for (const element of [cover, copy]) element.style.opacity = '0';
    if (travel) travel.append(copy);
    host.append(cover, travel ?? copy);
  };
  const start = (startTime: number) => {
    if (isStopped || isStarted) return;
    if (!isAttached) throw new Error('The text-run copy is not attached');
    isStarted = true;
    try {
      for (const element of [cover, copy]) element.style.opacity = '';
      animations.push(
        copy.animate(frames, { duration: durationMs, fill: 'both' }),
      );
      /* Both disappear only when the copy has returned exactly to its origin. */
      for (const element of [cover, copy])
        animations.push(
          element.animate(
            [
              { offset: 0, opacity: 0, easing: 'steps(1, end)' },
              { offset: showAt, opacity: 1, easing: 'steps(1, end)' },
              { offset: hideAt, opacity: 0 },
              { offset: 1, opacity: 0 },
            ],
            { duration: durationMs, fill: 'both' },
          ),
        );
      if (travel && travelFrames)
        animations.push(
          travel.animate(travelFrames, { duration: durationMs, fill: 'both' }),
        );
      animations.forEach((animation) => {
        animation.startTime = startTime;
      });
    } catch (error) {
      stop();
      throw error;
    }
  };
  return { attach, start, stop };
};
