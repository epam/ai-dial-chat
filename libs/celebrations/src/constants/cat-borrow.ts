import type { LottieMarkerVocabulary } from '../models/lottie-markers';
import {
  CatBorrowAnchor,
  CatBorrowMarker,
  CatBorrowSection,
} from '../types/cat-borrow';

const PRIZES = ['0', '1'];

/** The `cat:` markers `interaction-cat-borrow-v1` reads. */
export const CAT_BORROW_MARKERS: LottieMarkerVocabulary = {
  namespace: 'cat',
  scopeKind: CatBorrowMarker.Section,
  kinds: {
    [CatBorrowMarker.Section]: {
      arguments: Object.values(CatBorrowSection),
      duration: true,
    },
    [CatBorrowMarker.Branch]: {
      arguments: [CatBorrowSection.OnePrize],
      duration: false,
    },
    [CatBorrowMarker.Bind]: {
      arguments: Object.values(CatBorrowAnchor),
      duration: true,
      exclusive: true,
    },
    [CatBorrowMarker.Entry]: { arguments: PRIZES, duration: false },
    [CatBorrowMarker.Contact]: {
      arguments: PRIZES,
      duration: false,
      maxPerScope: 4,
    },
    [CatBorrowMarker.Release]: { arguments: PRIZES, duration: false },
    [CatBorrowMarker.Landing]: { arguments: PRIZES },
    [CatBorrowMarker.Restore]: { duration: false },
  },
  order: [
    CatBorrowMarker.Entry,
    CatBorrowMarker.Contact,
    CatBorrowMarker.Release,
    CatBorrowMarker.Landing,
    CatBorrowMarker.Restore,
  ],
};

/** Prefix of the static nulls holding each anchor's reference position. */
export const CAT_BORROW_ANCHOR_PREFIX = 'anchor:';

/** The authored cat's height-defining size at stage scale 1, in stage units. */
export const CAT_BORROW_REFERENCE_SIZE = 140;
