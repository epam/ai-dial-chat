import {
  BORROW_BUTTON_NODE_LIMIT,
  findBorrowTargets,
  type BorrowTargets,
} from '../../utils/borrow-targets';

/** The Cat's prizes and landing ledges; the rules live in `borrow-targets`. */
export type CatTargets = BorrowTargets;

/** Most descendants a borrowed button may have. */
export const CAT_BUTTON_NODE_LIMIT = BORROW_BUTTON_NODE_LIMIT;

/** Capture nearby prizes and landing ledges without copying or changing live UI. */
export const getCatTargets = findBorrowTargets;
