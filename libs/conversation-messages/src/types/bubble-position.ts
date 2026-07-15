/** Controls which corners of the message bubble are rounded, allowing adjacent bubbles to visually group together. */
export enum BubblePosition {
  /** First bubble in a group — rounds the bottom-right corner. */
  Bottom = 'Bottom',
  /** Subsequent bubble in a group — rounds the top-right corner. */
  Top = 'Top',
}
