import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useComposerInterrupts } from '../../hooks/useComposerInterrupts';
import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationTextDirection } from '../../models/celebration-pack';
import {
  getVisibleViewport,
  measureCornerTargets,
  type CornerRect,
} from '../../utils/composer-corner-geometry';
import { findComposerCornerPosterPlacement } from '../../utils/composer-corner-poster';
import { watchComposer } from '../../utils/composer-watch';
import { observeSceneTargets } from '../../utils/scene-targets';

/** Inputs of the static, capability-scoped corner fallback. */
export interface ComposerCornerPosterProps {
  /** Resolved static image URL. */
  src: string;
  /** Semantic host targets protected from the artwork. */
  anchors: CelebrationAnchors;
  /** Host writing direction. */
  direction: CelebrationTextDirection;
  /** Whether the text-free artwork mirrors horizontally. */
  isMirrored: boolean;
  /** Also reserves supplied history containers for scenes that interact with them. */
  protectHistory?: boolean;
  /** Ends the owning activation and releases its existing expiry deadline. */
  onDismiss: () => void;
}

const WATCHED_ANCHORS = [
  'composer',
  'composerAddCluster',
  'composerModelSelector',
  'starterList',
  'welcomeRegion',
] as const;

/** Shows a static image only when its readable bounds leave host content clear. */
export const ComposerCornerPoster: FC<ComposerCornerPosterProps> = ({
  src,
  anchors,
  direction,
  isMirrored,
  protectHistory = false,
  onDismiss,
}) => {
  const [initial] = useState(() => ({
    src,
    anchors: { ...anchors },
    direction,
    isMirrored,
    protectHistory,
  }));
  const hasChanged =
    initial.src !== src ||
    initial.direction !== direction ||
    initial.isMirrored !== isMirrored ||
    initial.protectHistory !== protectHistory ||
    (initial.protectHistory &&
      initial.anchors.historyContainer !== anchors.historyContainer) ||
    WATCHED_ANCHORS.some((key) => initial.anchors[key] !== anchors[key]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [placement, setPlacement] = useState<CornerRect | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isMountedRef = useRef(false);
  const isDismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const disposersRef = useRef<(() => void)[]>([]);
  const geometryRef = useRef<{
    viewport: CornerRect;
    protectedRects: CornerRect[];
  } | null>(null);

  const dismiss = useCallback(() => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;
    if (imageRef.current) imageRef.current.style.visibility = 'hidden';
    for (const dispose of disposersRef.current.splice(0)) dispose();
    setIsDismissed(true);
    onDismissRef.current();
  }, []);

  useComposerInterrupts(!isDismissed && !hasChanged, dismiss);

  const placeImage = useCallback(
    (image: HTMLImageElement) => {
      if (!isMountedRef.current || isDismissedRef.current) return;
      const geometry = geometryRef.current;
      if (!geometry) return;
      const next = findComposerCornerPosterPlacement(
        geometry.viewport,
        geometry.protectedRects,
        image.naturalWidth / image.naturalHeight,
        initial.direction,
      );
      if (!next) dismiss();
      else setPlacement(next);
    },
    [initial.direction, dismiss],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const dispose = () => {
      isMountedRef.current = false;
      geometryRef.current = null;
      for (const cleanup of disposersRef.current.splice(0)) cleanup();
    };
    if (hasChanged || isDismissedRef.current) {
      dismiss();
      return dispose;
    }
    try {
      if (
        typeof MutationObserver !== 'function' ||
        typeof ResizeObserver !== 'function'
      ) {
        dismiss();
        return dispose;
      }
      const host = hostRef.current;
      const viewport = getVisibleViewport();
      const targets = measureCornerTargets(
        initial.anchors,
        initial.protectHistory ? [initial.anchors.historyContainer] : [],
      );
      if (!host || !viewport || !targets) {
        dismiss();
        return dispose;
      }
      geometryRef.current = {
        viewport,
        protectedRects: targets.protectedTargets.map(({ rect }) => rect),
      };
      const addDisposer = (cleanup: () => void) =>
        disposersRef.current.push(cleanup);
      /* With no targets yet, a newly mounted input must dismiss this still. */
      const watched = targets.watched.length
        ? targets.watched
        : [document.documentElement];
      addDisposer(
        observeSceneTargets(
          watched,
          dismiss,
          [host],
          targets.hasTargetSetChanged,
        ),
      );
      for (const source of targets.composers)
        watchComposer({ source, host, cancel: dismiss, addDisposer });
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth > 0) placeImage(image);
    } catch {
      dismiss();
    }
    return dispose;
  }, [
    hasChanged,
    initial.anchors,
    initial.protectHistory,
    dismiss,
    placeImage,
  ]);

  if (isDismissed || hasChanged) return null;
  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 select-none"
      dir={direction}
      aria-hidden
      inert
    >
      <img
        ref={imageRef}
        src={src}
        alt=""
        role="presentation"
        draggable={false}
        className="absolute"
        style={{
          /* These are measured physical viewport coordinates, not inline flow. */
          left: placement?.left ?? 0,
          top: placement?.top ?? 0,
          width: placement?.width ?? 0,
          height: placement?.height ?? 0,
          visibility: placement ? 'visible' : 'hidden',
          transform: isMirrored ? 'scaleX(-1)' : undefined,
        }}
        onLoad={(event) => placeImage(event.currentTarget)}
        onError={dismiss}
      />
    </div>
  );
};
