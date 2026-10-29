/** Canvas width calculation mode. */
export enum CanvasWidthMode {
  BoundedPanel = 'bounded-panel',
  Conversation = 'conversation',
}
/** Host-owned numeric layout policy. */
export interface CanvasWidthPolicy {
  /** Bounded-panel minimum width. */
  minWidth: number;
  /** Bounded-panel preferred maximum width. */
  defaultMaxWidth: number;
  /** Bounded-panel viewport share. */
  widthRatio: number;
  /** Minimum content budget used by conversation mode. */
  minContentWidth: number;
}
/** Inputs for canvas width calculation. */
export interface ResolveCanvasWidthParams {
  /** Calculation mode. */
  mode: CanvasWidthMode;
  /** Whether the panel fills the viewport. */
  isMobile: boolean;
  /** Viewport width in pixels. */
  viewportWidth: number;
  /** Available width in pixels. */
  maxWidth: number;
  /** Host layout values. */
  policy: CanvasWidthPolicy;
}
/** Initial and minimum canvas widths in pixels. */
export interface CanvasWidth {
  /** Initial width. */
  defaultWidth: number;
  /** Bounded-panel minimum; undefined in conversation mode. */
  minWidth: number | undefined;
}
/** Calculates canvas width using the supplied numeric policy. */
export const resolveCanvasWidth = ({
  mode,
  isMobile,
  viewportWidth,
  maxWidth,
  policy,
}: ResolveCanvasWidthParams): CanvasWidth => {
  const minWidth =
    mode === CanvasWidthMode.BoundedPanel ? policy.minWidth : undefined;
  if (isMobile) return { defaultWidth: viewportWidth, minWidth };
  if (mode === CanvasWidthMode.BoundedPanel) {
    const share = Math.round(viewportWidth * policy.widthRatio);
    const bounded = Math.max(
      policy.minWidth,
      Math.min(policy.defaultMaxWidth, share),
    );
    return { defaultWidth: Math.min(maxWidth, bounded), minWidth };
  }
  return {
    defaultWidth: Math.min(
      maxWidth,
      Math.round((maxWidth + policy.minContentWidth) * 0.5),
    ),
    minWidth,
  };
};
