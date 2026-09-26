import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { CELEBRATIONS_CLASS } from '../constants/public-class-names';
import type {
  CelebrationContextValue,
  CelebrationEvent,
  CelebrationEventLoader,
  CelebrationProviderProps,
  CelebrationScene,
} from '../models/celebration';
import {
  interpolateCelebrationLabel,
  matchesCelebrationPhrase,
  pickCelebrationScene,
  resolveCelebrationPools,
} from '../utils/celebration';
import {
  CelebrationEnvironmentContext,
  type CelebrationEnvironment,
} from './CelebrationEnvironmentContext';

/* Decoration must also be safe in hosts that omit this optional provider. */
const CelebrationContext = createContext<CelebrationContextValue>({
  event: null,
  isEnabled: false,
  celebrate: () => undefined,
  activate: () => undefined,
  consumeSecretPhrase: () => false,
});

const EMPTY_LABELS: Readonly<Record<string, string>> = {};

const loadEvent = async (
  load: CelebrationEventLoader,
): Promise<CelebrationEvent> => {
  const loaded = await load();
  return 'default' in loaded ? loaded.default : loaded;
};

/** Owns celebration playback; hosts pass every external input as props. */
export const CelebrationProvider: FC<CelebrationProviderProps> = ({
  children,
  events,
  activeEventId,
  resetKey,
  labels,
  onNotify,
  isMobile = false,
  anchors,
  selection,
  portalContainer,
}) => {
  const [loaded, setLoaded] = useState<{
    event: CelebrationEvent;
    resetKey: unknown;
  } | null>(null);
  const [active, setActive] = useState<{
    scene: CelebrationScene;
    event: CelebrationEvent;
    resetKey: unknown;
    token: number;
  } | null>(null);
  const tokenRef = useRef(0);
  const previousClick = useRef<string | undefined>(undefined);
  const previousSecret = useRef<string | undefined>(undefined);
  /* Loaders usually arrive as an inline object; only the selected one matters. */
  const load = activeEventId ? events[activeEventId] : undefined;
  const loadRef = useRef(load);
  loadRef.current = load;
  const hasLoader = load !== undefined;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const event =
    loaded?.event.id === activeEventId && loaded?.resetKey === resetKey
      ? loaded.event
      : null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setActive(null);
    previousClick.current = undefined;
    previousSecret.current = undefined;
    const loader = loadRef.current;
    if (activeEventId && loader) {
      const run = async () => {
        try {
          const next = await loadEvent(loader);
          if (!cancelled && next.id === activeEventId) {
            setLoaded({ event: next, resetKey });
          }
        } catch {
          /* A missing decorative chunk must leave the host usable. */
        }
      };
      void run();
    }
    return () => {
      cancelled = true;
    };
  }, [activeEventId, hasLoader, resetKey]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(
      () => setActive(null),
      active.scene.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  const eventSelection = event ? selection?.[event.id] : undefined;
  const pools = useMemo(
    () => (event ? resolveCelebrationPools(event, eventSelection) : null),
    [event, eventSelection],
  );
  const eventLabels = event ? labels?.[event.id] : undefined;
  const resolvedLabels = useMemo(
    () =>
      event
        ? {
            ...event.labels,
            ...Object.fromEntries(
              Object.entries(eventLabels ?? {}).filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
            ),
          }
        : EMPTY_LABELS,
    [event, eventLabels],
  );

  const celebrate = useCallback(
    (sceneId: string) => {
      const scene = event?.scenes.find((candidate) => candidate.id === sceneId);
      if (!event || !scene || !pools?.enabledSceneIds.has(sceneId)) return;
      setActive({ scene, event, resetKey, token: ++tokenRef.current });
      const phrase = pools.isSecretEnabled
        ? (event.secretTrigger?.hintPhrase ?? '')
        : '';
      onNotifyRef.current?.({
        title: resolvedLabels[event.titleLabelId] ?? '',
        message: interpolateCelebrationLabel(
          resolvedLabels[scene.labelId] ?? '',
          phrase,
        ),
      });
    },
    [event, pools, resetKey, resolvedLabels],
  );

  const activate = useCallback(() => {
    if (!pools) return;
    const id = pickCelebrationScene(pools.clickSceneIds, previousClick.current);
    if (id === undefined) return;
    previousClick.current = id;
    celebrate(id);
  }, [pools, celebrate]);

  const consumeSecretPhrase = useCallback(
    (text: string) => {
      const trigger = event?.secretTrigger;
      if (
        !trigger ||
        !pools?.isSecretEnabled ||
        !matchesCelebrationPhrase(text, trigger.phrases)
      )
        return false;
      const id = pickCelebrationScene(
        pools.secretSceneIds,
        previousSecret.current,
      );
      if (id === undefined) return false;
      previousSecret.current = id;
      celebrate(id);
      return true;
    },
    [event, pools, celebrate],
  );

  const value = useMemo(
    () => ({
      event,
      isEnabled: event !== null,
      celebrate,
      activate,
      consumeSecretPhrase,
    }),
    [event, celebrate, activate, consumeSecretPhrase],
  );
  const environment = useMemo<CelebrationEnvironment>(
    () => ({
      isMobile,
      anchors: anchors ?? {},
      labels: resolvedLabels,
      isDecorBehaviorEnabled: (behavior) =>
        pools?.enabledDecorBehaviors.has(behavior) ?? true,
    }),
    [isMobile, anchors, resolvedLabels, pools],
  );
  const Scene = active?.scene.Component;
  const container =
    portalContainer ??
    (typeof document === 'undefined' ? undefined : document.body);

  return (
    <CelebrationContext.Provider value={value}>
      <CelebrationEnvironmentContext.Provider value={environment}>
        {children}
        {event &&
          active?.event === event &&
          active.resetKey === resetKey &&
          Scene &&
          container &&
          createPortal(
            <ErrorBoundary key={active.token} fallback={null}>
              <div
                aria-hidden="true"
                className={mergeClasses(
                  'pointer-events-none fixed inset-0 z-[70] select-none overflow-hidden',
                  CELEBRATIONS_CLASS.sceneLayer,
                )}
              >
                <Scene />
              </div>
            </ErrorBoundary>,
            container,
          )}
      </CelebrationEnvironmentContext.Provider>
    </CelebrationContext.Provider>
  );
};

/** Returns the celebration state; an inert value outside `CelebrationProvider`. */
export const useCelebration = (): CelebrationContextValue =>
  useContext(CelebrationContext);
