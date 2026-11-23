/** A measured run of text in a textarea, never an editable clone or a mutation of the draft. */
export interface TextRun {
  /** The textarea whose value or placeholder holds the run. */
  element: HTMLTextAreaElement;
  /** Viewport bounds of the run's glyphs. */
  rect: DOMRect;
  /** The run's text. */
  text: string;
  /** Font and ink styles that reproduce the run outside the textarea. */
  style: Partial<CSSStyleDeclaration>;
  /** Opaque background colour behind the run, used to cover its pixels. */
  background: string;
}

/** How a text-run copy and its cover animate. */
export interface TextRunCopyOptions {
  /** Length of every animation, in milliseconds. */
  durationMs: number;
  /** Offset at which the copy and the cover appear. */
  showAt: number;
  /** Offset at which the copy and the cover disappear. */
  hideAt: number;
  /** Keyframes of the copy, from the run's own position. */
  frames: Keyframe[];
  /** Keyframes of an outer layer that carries the copy, composed like a parent transform. */
  travelFrames?: Keyframe[];
  /** Runs once both elements exist, before they are attached. */
  decorate?: (copy: HTMLElement, cover: HTMLElement) => void;
}

/** A text-run copy prepared ahead of time, started on another actor's clock. */
export interface TextRunCopySession {
  /** Appends the cover and the copy to `host`, invisible. */
  attach: (host: HTMLElement) => void;
  /** Starts every animation at `startTime`. */
  start: (startTime: number) => void;
  /** Removes the cover and the copy and cancels every animation once; later calls do nothing. */
  stop: () => void;
}
