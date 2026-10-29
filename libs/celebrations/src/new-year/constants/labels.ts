import type { NewYearLabels } from '../models/labels';

/** English defaults for every New Year label. */
export const NEW_YEAR_LABELS = {
  penguinStarToastMessage:
    'Every tree deserves a star. Send "{{phrase}}" in the start-page chat for a secret surprise.',
  giftWrappingToastMessage:
    'Some gifts have a mind of their own. Send "{{phrase}}" in the start-page chat for a secret surprise.',
  snowmanDeliveryToastMessage:
    'Delivered in one piece, almost. Send "{{phrase}}" in the start-page chat for a secret surprise.',
  toastTitle: 'Happy New Year!',
  giftLabel: 'New Year gift',
} satisfies NewYearLabels;
