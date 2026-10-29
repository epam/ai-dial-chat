/** Visible text of the New Year event; `{{phrase}}` becomes the secret hint. */
export interface NewYearLabels {
  /** Notification message of the penguin and star scene. */
  penguinStarToastMessage?: string;
  /** Notification message of the gift-wrapping scene. */
  giftWrappingToastMessage?: string;
  /** Notification message of the snowman delivery scene. */
  snowmanDeliveryToastMessage?: string;
  /** Title of every scene notification. */
  toastTitle: string;
  /** Accessible name of the gift trigger. */
  giftLabel: string;
}
