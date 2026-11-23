import type { TextRun } from '../../models/text-run-copy';
import { findTextRun, prepareTextRunCopy } from '../../utils/text-run-copy';

/** A measured word, never an editable clone or a mutation of the draft. */
export type ReindeerText = TextRun;

/** Measure a short visible word with a disposable native-layout mirror. */
export const getReindeerText = findTextRun;

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
  const session = prepareTextRunCopy(word, {
    durationMs: duration,
    showAt: caught,
    hideAt: restored,
    frames,
    decorate: (copy, cover) => {
      copy.dataset.reindeerWord = 'true';
      cover.dataset.reindeerWordMask = 'true';
    },
  });
  session.attach(host);
  session.start(startTime);
  return session.stop;
};
