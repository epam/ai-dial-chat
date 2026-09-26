import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { CelebrationDecor } from '../components/CelebrationDecor/CelebrationDecor';
import {
  CelebrationProvider,
  useCelebration,
} from '../context/CelebrationContext';
import type {
  CelebrationEvent,
  CelebrationEventSelection,
  CelebrationNotification,
} from '../models/celebration';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/* Scenes read the media query while mounting, so the override has to be in
   place before the subtree renders; the key below remounts it on change. */
const useReducedMotionOverride = (isReduced: boolean) => {
  useMemo(() => {
    if (typeof window === 'undefined') return;
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === REDUCED_MOTION_QUERY
        ? ({
            matches: isReduced,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList)
        : original(query);
  }, [isReduced]);
};

export interface ScenePlayerProps {
  /** The event whose scene plays. */
  event: CelebrationEvent;
  /** Scene to play on mount and on replay; the decoration alone when omitted. */
  sceneId?: string;
  /** Whether scenes use their mobile layout. */
  isMobile?: boolean;
  /** Document direction of the fixture page. */
  dir?: 'ltr' | 'rtl';
  /** Simulates `prefers-reduced-motion: reduce`. */
  isReducedMotion?: boolean;
  /** Host scene and decoration selection for the event. */
  selection?: CelebrationEventSelection;
  /** Extra content inside the provider, such as playground controls. */
  children?: ReactNode;
}

const Autoplay: FC<{ sceneId?: string }> = ({ sceneId }) => {
  const { event, celebrate } = useCelebration();
  useEffect(() => {
    if (event && sceneId) celebrate(sceneId);
  }, [event, sceneId, celebrate]);
  if (!sceneId) return null;
  return (
    <button
      type="button"
      className="bg-layer-2 fixed bottom-3 start-3 z-[80] rounded border px-3 py-1.5"
      onClick={() => celebrate(sceneId)}
    >
      Replay
    </button>
  );
};

/** Renders the real provider on a fixture page and plays one scene. */
export const ScenePlayer: FC<ScenePlayerProps> = ({
  event,
  sceneId,
  isMobile = false,
  dir = 'ltr',
  isReducedMotion = false,
  selection,
  children,
}) => {
  useReducedMotionOverride(isReducedMotion);
  const [notification, setNotification] =
    useState<CelebrationNotification | null>(null);
  const events = useMemo(() => ({ [event.id]: async () => event }), [event]);
  const selections = useMemo(
    () => (selection ? { [event.id]: selection } : undefined),
    [event.id, selection],
  );

  return (
    <div dir={dir} key={`${String(isReducedMotion)}-${dir}`}>
      <CelebrationProvider
        events={events}
        activeEventId={event.id}
        isMobile={isMobile}
        anchors={STORY_ANCHORS}
        selection={selections}
        onNotify={setNotification}
      >
        <StoryHostPage>
          <CelebrationDecor />
        </StoryHostPage>
        <Autoplay sceneId={sceneId} />
        {children}
      </CelebrationProvider>
      {/* The live region stays mounted; only a filled toast draws a frame. */}
      <div
        role="status"
        aria-live="polite"
        className={
          notification
            ? 'bg-layer-2 fixed end-3 top-3 z-[80] max-w-xs rounded border p-3'
            : 'sr-only'
        }
      >
        {notification && (
          <>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </>
        )}
      </div>
    </div>
  );
};
